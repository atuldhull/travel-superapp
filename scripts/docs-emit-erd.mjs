#!/usr/bin/env node
/**
 * docs-emit-erd.mjs — parse apps/api/prisma/schema.prisma and emit
 * docs/architecture/data-model.md (Mermaid `erDiagram` per bounded-context
 * cluster + a model-ownership table).
 *
 * Why a hand-rolled parser instead of `prisma-erd-generator`:
 *   - Zero dev-deps (the generator pulls mermaid-cli + ~50 transitive deps).
 *   - We need cluster grouping, which the generator doesn't do — it emits
 *     one giant diagram with 64 boxes that no human can read.
 *   - Drift gate becomes a trivial `git diff --exit-code` instead of a
 *     "diff two SVGs by pixel" exercise.
 *
 * Usage:
 *     pnpm docs:erd            # writes docs/architecture/data-model.md
 *     pnpm docs:erd:check      # exits non-zero if the file would change
 *
 * Installed by [P4] of the Documentation 8.5→10 series.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const schemaPath = join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma');
const outPath = join(repoRoot, 'docs', 'architecture', 'data-model.md');

const checkMode = process.argv.includes('--check');

// ─── Cluster map (matches docs/architecture/c4/components-api.md) ────────
// Each model is assigned to exactly one cluster. If a model is added to
// schema.prisma without being added here, the script falls back to
// "Unclustered" + warns + (in --check mode) exits non-zero.

const CLUSTERS = {
  Identity: [
    'User',
    'BanAppeal',
    'UserOAuthIdentity',
    'Session',
    'MagicLinkToken',
    'PasswordResetToken',
    'MfaBackupCode',
    'Preferences',
    'Device',
    'LoginCode',
  ],
  Trip: ['Trip', 'ItineraryDay', 'ItineraryItem', 'TripVersion', 'TripWatch', 'TripPublication'],
  PlaceDiscovery: [
    'Place',
    'PlaceTag',
    'PlaceEmbedding',
    'Stay',
    'StayPrice',
    'StayBooking',
    'Eatery',
    'Dish',
    'DishTag',
    'RouteLeg',
    'TransitSchedule',
    'WeatherForecast',
    'Alert',
    'Event',
    'EventSource',
  ],
  Safety: [
    'CrimeIncident',
    'ScamReport',
    'Agent',
    'SosEvent',
    'TrustedContact',
    'AgentRun',
    'AgentStep',
  ],
  LiveAndDiary: ['Geofence', 'LiveEvent', 'DiaryEntry'],
  SocialAndMemory: [
    'TripShare',
    'Vote',
    'Expense',
    'Review',
    'UserKarma',
    'HelpfulVote',
    'Follow',
    'UserBlock',
    'TripComment',
    'GamificationProfile',
    'EarnedBadge',
    'MediaAsset',
    'MemoryBook',
  ],
  Money: ['Subscription', 'EscrowHold', 'Commission'],
  Platform: [
    'NotificationPreference',
    'PushSubscription',
    'NotificationLog',
    'AdminUser',
    'ModerationItem',
    'FeatureFlag',
    'AdminAuditLog',
  ],
};

const CLUSTER_BLURBS = {
  Identity:
    'Auth + sessions + preferences + the OAuth / magic-link / password-reset tokens. User is the only model with soft-delete (GDPR erasure cascade is fan-out from Identity.UserDeleted).',
  Trip: 'The itinerary aggregate — Trip owns days, items, immutable versions, and the publish-state shadow (TripWatch, TripPublication).',
  PlaceDiscovery:
    'Catalog + decoration of places. Stays / Food / Transport / Weather / Events all hang off Place via geo or context-map ports.',
  Safety:
    'Crime + scam DB, the agent verification flow, SOS lifecycle, and the AgentRun / AgentStep audit trail for AI-assisted ops.',
  LiveAndDiary:
    'What runs DURING a trip — geofences fire LiveEvents, which feed the LLM-driven diary writer.',
  SocialAndMemory:
    'Sharing, voting, reviews, expenses, follow graph, gamification, and the memory-book composer (media + final PDF).',
  Money:
    'Subscriptions + agent escrow + commission ledger. Stripe is the source of truth; rows here mirror the webhook events.',
  Platform:
    'Notifications (prefs + log), admin tooling (users + moderation queue + flags + audit log).',
};

// ─── Parser ──────────────────────────────────────────────────────────────

const SCALAR_TYPES = new Set([
  'String',
  'Int',
  'BigInt',
  'Boolean',
  'DateTime',
  'Float',
  'Decimal',
  'Json',
  'Bytes',
  'Unsupported',
]);

function parseSchema(src) {
  // Strip line comments — but preserve them inside strings (none of our
  // schema has // inside strings, but be tidy).
  const noComments = src.replace(/\/\/.*$/gm, '');

  const enums = new Set();
  for (const m of noComments.matchAll(/^enum\s+(\w+)\s*\{/gm)) {
    enums.add(m[1]);
  }

  const models = [];
  const modelRe = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
  for (const m of noComments.matchAll(modelRe)) {
    const name = m[1];
    const body = m[2];
    const fields = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('@@')) continue; // model-level attribute
      // field shape: <name> <Type>[?][[]] <@attrs...>
      const fieldMatch = trimmed.match(/^(\w+)\s+([A-Za-z][\w]*)(\?|\[\])?(.*)$/);
      if (!fieldMatch) continue;
      const [, fname, type, modifier, attrs] = fieldMatch;
      const isList = modifier === '[]';
      const isOptional = modifier === '?';
      const isId = /\B@id\b/.test(attrs);
      const isUnique = /\B@unique\b/.test(attrs);
      const isRelation = /\B@relation\b/.test(attrs);
      fields.push({
        name: fname,
        type,
        isList,
        isOptional,
        isId,
        isUnique,
        isRelation,
        raw: trimmed,
      });
    }
    models.push({ name, fields });
  }

  return { models, enums };
}

function classifyField(field, modelNames, enums) {
  if (SCALAR_TYPES.has(field.type)) return 'scalar';
  if (enums.has(field.type)) return 'enum';
  if (modelNames.has(field.type)) return 'relation';
  return 'scalar'; // unknown type — treat as scalar
}

function relationsFor(model, modelNames, enums) {
  const out = [];
  for (const f of model.fields) {
    if (classifyField(f, modelNames, enums) !== 'relation') continue;
    out.push({
      to: f.type,
      via: f.name,
      cardinality: f.isList ? 'many' : f.isOptional ? 'zero-one' : 'one',
    });
  }
  return out;
}

// ─── Emitter ─────────────────────────────────────────────────────────────

function mermaidIdent(name) {
  // Mermaid erDiagram identifiers — uppercase, alphanumeric.
  return name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function mermaidScalar(type) {
  // Map Prisma types to Mermaid erDiagram tokens. The grammar accepts only
  // alphanumeric tokens — no `?` (optional) or `[]` (list) suffixes. Caller
  // strips those before composing the line.
  return type.toLowerCase();
}

function emitErDiagram(cluster, clusterModels, modelByName, modelNames, enums) {
  const lines = ['```mermaid', 'erDiagram'];
  // Box per model with up to 6 fields (id + 5 most-informative).
  for (const m of clusterModels) {
    const id = mermaidIdent(m.name);
    lines.push(`    ${id} {`);
    const visible = m.fields
      .filter((f) => classifyField(f, modelNames, enums) !== 'relation')
      .slice(0, 6);
    for (const f of visible) {
      // Mermaid erDiagram accepts: TYPE name [PK|FK|UK] "optional comment"
      // Optional / list suffixes are not part of the grammar — render them
      // in the trailing comment instead.
      const flag = f.isId ? 'PK' : f.isUnique ? 'UK' : '';
      const typeStr = mermaidScalar(f.type);
      const note = f.isList ? '"list"' : f.isOptional ? '"optional"' : '';
      const parts = [`        ${typeStr}`, f.name];
      if (flag) parts.push(flag);
      if (note) parts.push(note);
      lines.push(parts.join(' '));
    }
    lines.push('    }');
  }
  // Relations — only those where BOTH ends are in this cluster.
  const inCluster = new Set(clusterModels.map((m) => m.name));
  const emitted = new Set();
  for (const m of clusterModels) {
    for (const r of relationsFor(m, modelNames, enums)) {
      if (!inCluster.has(r.to)) continue;
      // Dedupe — Prisma writes both sides of a relation; pick the "many" side
      // as canonical, falling back to alphabetic order.
      const key = [m.name, r.to].sort().join('::');
      if (emitted.has(key)) continue;
      emitted.add(key);
      const a = mermaidIdent(m.name);
      const b = mermaidIdent(r.to);
      // Generic many-to-zero-or-many — we don't try to over-specify cardinality
      // (schema.prisma has the precise types if a reviewer needs them).
      lines.push(`    ${a} }o--o{ ${b} : "${r.via}"`);
    }
  }
  lines.push('```');
  return lines.join('\n');
}

function emitCrossClusterTable(models, clusters, modelNames, enums) {
  const modelToCluster = new Map();
  for (const [c, list] of Object.entries(clusters)) {
    for (const m of list) modelToCluster.set(m, c);
  }
  const rows = [];
  for (const m of models) {
    const fromC = modelToCluster.get(m.name);
    if (!fromC) continue;
    for (const r of relationsFor(m, modelNames, enums)) {
      const toC = modelToCluster.get(r.to);
      if (!toC || toC === fromC) continue;
      rows.push({ from: m.name, fromC, to: r.to, toC, via: r.via });
    }
  }
  // Dedupe by sorted pair.
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    const k = [r.from, r.to].sort().join('::');
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
  }
  unique.sort((a, b) => a.fromC.localeCompare(b.fromC) || a.from.localeCompare(b.from));
  return unique;
}

// ─── Top-level ───────────────────────────────────────────────────────────

const src = readFileSync(schemaPath, 'utf-8');
const { models, enums } = parseSchema(src);
const modelNames = new Set(models.map((m) => m.name));
const modelByName = new Map(models.map((m) => [m.name, m]));

// Sanity-check: every model is in exactly one cluster.
const assigned = new Set();
const dupes = [];
for (const list of Object.values(CLUSTERS)) {
  for (const m of list) {
    if (assigned.has(m)) dupes.push(m);
    assigned.add(m);
  }
}
const unassigned = [...modelNames].filter((m) => !assigned.has(m));
const phantom = [...assigned].filter((m) => !modelNames.has(m));

if (dupes.length || unassigned.length || phantom.length) {
  console.error('✗ cluster map is out of sync with schema.prisma:');
  if (dupes.length) console.error(`    duplicated assignments: ${dupes.join(', ')}`);
  if (unassigned.length)
    console.error(`    models missing from CLUSTERS: ${unassigned.join(', ')}`);
  if (phantom.length)
    console.error(`    CLUSTERS references models not in schema.prisma: ${phantom.join(', ')}`);
  console.error('  → update CLUSTERS in scripts/docs-emit-erd.mjs and re-run.');
  process.exit(1);
}

// Emit the doc.
const out = [];
out.push('# Data model — ERD');
out.push('');
out.push(
  '> **Generated** by [`scripts/docs-emit-erd.mjs`](../../scripts/docs-emit-erd.mjs) from [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma). Do NOT edit by hand — re-run `pnpm docs:erd` after a schema change. The CI drift gate fails any PR that touches the schema without regenerating this file.',
);
out.push('>');
out.push(
  `> Models: **${models.length}** · Enums: **${enums.size}** · Clusters: **${Object.keys(CLUSTERS).length}** (matches [\`c4/components-api.md\`](./c4/components-api.md)).`,
);
out.push('');
out.push('## How to read');
out.push('');
out.push(
  '- One **Mermaid erDiagram** per cluster — boxes are models, lines are foreign-key relations within the cluster.',
);
out.push(
  '- Cardinality on the diagrams is shown as `}o--o{` (generic association) — the precise type lives in [`schema.prisma`](../../apps/api/prisma/schema.prisma); duplicating it here would only invite drift.',
);
out.push(
  '- Up to 6 representative scalar/enum fields per box (id + 5). Relation fields are shown as edges, not as box rows.',
);
out.push(
  '- **Cross-cluster relations** are listed at the bottom in a table — those are the seams between bounded contexts.',
);
out.push('');
out.push(`## Model-ownership index (${models.length} models)`);
out.push('');
out.push('| Cluster | Models |');
out.push('| ------- | ------ |');
for (const [cluster, list] of Object.entries(CLUSTERS)) {
  out.push(`| ${cluster} | ${list.map((m) => `\`${m}\``).join(', ')} |`);
}
out.push('');
out.push(
  `Maps 1-to-N onto the 17 bounded contexts in [\`context-map.md\`](./context-map.md) — see "Cluster legend" in [\`c4/components-api.md\`](./c4/components-api.md) for the mapping.`,
);
out.push('');

for (const [cluster, list] of Object.entries(CLUSTERS)) {
  out.push(`## ${cluster}`);
  out.push('');
  out.push(CLUSTER_BLURBS[cluster] || '');
  out.push('');
  const clusterModels = list.map((n) => modelByName.get(n));
  out.push(emitErDiagram(cluster, clusterModels, modelByName, modelNames, enums));
  out.push('');
}

const crossRefs = emitCrossClusterTable(models, CLUSTERS, modelNames, enums);
out.push('## Cross-cluster relations');
out.push('');
out.push(
  'These are the foreign keys that cross bounded-context lines — the seams to watch when you refactor a module.',
);
out.push('');
out.push('| From cluster | From model | → | To model | To cluster | Field |');
out.push('| ------------ | ---------- | - | -------- | ---------- | ----- |');
for (const r of crossRefs) {
  out.push(`| ${r.fromC} | \`${r.from}\` | → | \`${r.to}\` | ${r.toC} | \`${r.via}\` |`);
}
out.push('');
out.push('## Enums');
out.push('');
const enumList = [...enums].sort();
out.push(
  `${enumList.length} enums in [\`schema.prisma\`](../../apps/api/prisma/schema.prisma): ${enumList.map((e) => `\`${e}\``).join(' · ')}.`,
);
out.push('');
out.push('## Regenerate');
out.push('');
out.push('```sh');
out.push('pnpm docs:erd          # writes this file');
out.push('pnpm docs:erd:check    # CI drift gate: exits non-zero if regen would change anything');
out.push('```');
out.push('');
out.push('## See also');
out.push('');
out.push(
  '- [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) — the source of truth',
);
out.push('- [`context-map.md`](./context-map.md) — what each module owns + the event surface');
out.push('- [`c4/components-api.md`](./c4/components-api.md) — visual placement of these clusters');
out.push(
  '- [`docs/runbooks/supabase-deploy.md`](../runbooks/supabase-deploy.md) — how migrations land in prod',
);
out.push('');

const finalText = out.join('\n');

if (checkMode) {
  if (!existsSync(outPath)) {
    console.error(`✗ ${outPath} does not exist — run \`pnpm docs:erd\`.`);
    process.exit(1);
  }
  const existing = readFileSync(outPath, 'utf-8');
  if (existing.replace(/\r\n/g, '\n') !== finalText.replace(/\r\n/g, '\n')) {
    console.error(`✗ ${outPath} is stale relative to schema.prisma.`);
    console.error('  Run `pnpm docs:erd` and commit the result.');
    process.exit(1);
  }
  console.log(`✓ ${outPath} is in sync with schema.prisma.`);
} else {
  writeFileSync(outPath, finalText);
  console.log(
    `✓ wrote ${outPath} (${models.length} models, ${Object.keys(CLUSTERS).length} clusters).`,
  );
}
