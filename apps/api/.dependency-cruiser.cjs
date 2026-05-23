/**
 * dependency-cruiser — architecture enforcement for the NestJS API.
 *
 * Turns the clean/hexagonal dependency rule (CLAUDE.md #10:
 * `domain ← application ← infrastructure/interface`) from a
 * convention into a CHECK that fails. Run via `pnpm arch` (this
 * package) — wired into the `lint` turbo task so a layer violation
 * or an import cycle breaks the build, not a code review.
 *
 * Type-only imports ARE counted (`tsPreCompilationDeps: true`): in
 * clean architecture a domain layer must not even KNOW the types of
 * an outer layer, so an `import type` across the boundary is still
 * a violation.
 *
 * Layer folders, per module: `src/modules/<m>/{domain,application,
 * infrastructure,interface}/`. The `<m>.module.ts` file sits OUTSIDE
 * those folders — it is the composition root and is allowed to wire
 * infrastructure adapters to application ports.
 */
module.exports = {
  forbidden: [
    {
      name: 'hex-domain-stays-pure',
      comment:
        'A domain layer must not import from application / infrastructure / interface. ' +
        'The domain is the innermost layer — it depends on nothing outward (CLAUDE.md #10).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '^src/modules/[^/]+/(application|infrastructure|interface)/' },
    },
    {
      name: 'hex-application-no-infra-or-interface',
      comment:
        'An application layer (use-cases) must not import from infrastructure or interface. ' +
        'It depends only on the domain and on its own ports — adapters are injected.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/(infrastructure|interface)/' },
    },
    {
      name: 'hex-interface-no-direct-infrastructure',
      comment:
        'An interface layer (controllers) must not import infrastructure directly — it goes ' +
        'through application use-cases. Adapter→port wiring belongs in the <m>.module.ts ' +
        'composition root, which is not under interface/.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/interface/' },
      to: { path: '^src/modules/[^/]+/infrastructure/' },
    },
    {
      name: 'no-cross-module-infrastructure',
      comment:
        "A module must not import ANOTHER module's infrastructure layer. Concrete adapters " +
        '(Prisma repos, Redis caches, 3rd-party wrappers) are private implementation detail. ' +
        "Cross-module collaboration goes through the other module's ports / domain / NestJS " +
        'module — never its infrastructure.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/infrastructure/',
        pathNot: '^src/modules/$1/infrastructure/',
      },
    },
    {
      name: 'no-cross-module-interface',
      comment:
        "A module must not import ANOTHER module's interface layer (controllers). A controller " +
        'is an HTTP edge, not a programmatic API surface for sibling modules.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/interface/',
        pathNot: '^src/modules/$1/interface/',
      },
    },
    {
      name: 'no-cross-module-deep-import',
      comment:
        "Every module's public API is its `index.ts` barrel — it re-exports the NestJS module " +
        'class plus every application port. Cross-module consumers MUST go through the barrel; ' +
        "reaching into another module's domain/application/infrastructure/interface bypasses " +
        "the contract. The barrel explicitly enumerates what's public; everything else is " +
        'private implementation detail. Installed by [B2]; the `pathNot` allowlist below holds ' +
        'the files that still deep-import while [B3]/[B4] burn them down; [B5] removes the ' +
        'allowlist and the rule becomes uniformly strict.',
      severity: 'error',
      from: {
        path: '^src/modules/([^/]+)/',
        // Files still on legacy deep imports — to be migrated in
        // [B3] (domain) / [B4] (orchestration). When this list is
        // empty, [B5] drops the pathNot and the rule is fully strict.
        pathNot: [
          // [B3] — domain-layer cross-module imports (all migrated; allowlist
          // empty for this group). Event payload types are now re-exported
          // from each producer module's barrel; `Trip` + `Place` entity
          // types likewise. `SeedSampleTripUseCase` exposed on the trip
          // barrel as a public composition seam for identity onboarding.
          // [B4] — trip-as-orchestrator + admin-helper cross-module imports
          '^src/modules/trip/application/admin-archive-trip\\.use-case\\.ts$',
          '^src/modules/trip/application/admin-delete-trip\\.use-case\\.ts$',
          '^src/modules/trip/application/get-trip-eateries\\.use-case\\.ts$',
          '^src/modules/trip/application/get-trip-events\\.use-case\\.ts$',
          '^src/modules/trip/application/get-trip-overview\\.use-case\\.ts$',
          '^src/modules/trip/application/get-trip-stays\\.use-case\\.ts$',
          '^src/modules/trip/application/get-trip-transport-legs\\.use-case\\.ts$',
          '^src/modules/trip/application/get-trip-weather\\.use-case\\.ts$',
          '^src/modules/trip/application/near-me-now\\.use-case\\.ts$',
          '^src/modules/trip/application/optimize-day-route\\.use-case\\.ts$',
          '^src/modules/trip/application/suggest-places-for-trip\\.use-case\\.ts$',
          '^src/modules/trip/interface/trip\\.controller\\.ts$',
          '^src/modules/account/application/admin-ban-user\\.use-case\\.ts$',
          '^src/modules/account/application/admin-unban-user\\.use-case\\.ts$',
          '^src/modules/admin/application/get-retention-stats\\.use-case\\.ts$',
          '^src/modules/media/application/admin-delete-media\\.use-case\\.ts$',
          '^src/modules/safety/application/admin-resolve-sos\\.use-case\\.ts$',
          '^src/modules/safety/application/dismiss-scam-report\\.use-case\\.ts$',
          '^src/modules/safety/application/verify-scam-report\\.use-case\\.ts$',
        ],
      },
      to: {
        path: '^src/modules/[^/]+/',
        // Allowed cross-module targets: same-module (always) OR the
        // public barrel (`<m>/index.ts`).
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'no-circular',
      comment:
        'A circular import breaks module-init order (esbuild/ESM trips on it where CJS ' +
        'tolerates it — see the payments dev-server incident) and signals a design problem. ' +
        'Two exclusions: (1) the violation FROM is not a `<m>.module.ts` or a per-module ' +
        '`index.ts` barrel — those are composition-root tier; (2) the cycle path passes ' +
        'through at least one `<m>.module.ts`, meaning it is a NestJS module-graph cycle ' +
        'sanctioned by `forwardRef()`. Cycles that touch no module file are still caught.',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.module\\.ts$|^src/modules/[^/]+/index\\.ts$' },
      to: { circular: true, viaNot: '\\.module\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['main', 'types'],
    },
  },
};
