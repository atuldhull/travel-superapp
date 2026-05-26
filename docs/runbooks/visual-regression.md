# Runbook — Visual regression

> **Installed by [R2]** of the road-to-10-partials closeout. Companion to [`apps/web/e2e/`](../../apps/web/e2e/) + [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (the `e2e` job).
>
> Visual regression means: "does the page look the same as it did before this PR?" The repo answers with **pixel-diff against committed baselines** ($0, $0 forever) plus a **Chromatic** SaaS path that an operator can flip on with one secret. This runbook is the procedure for both, including how to handle the day a real UI change lands.

## Posture today

| Mechanism                                   | Cost                      | Status          | Where                                                                         |
| ------------------------------------------- | ------------------------- | --------------- | ----------------------------------------------------------------------------- |
| **In-repo Playwright `toHaveScreenshot()`** | $0                        | LIVE            | `apps/web/e2e/**/*.spec.ts` · baselines in `<spec>-snapshots/` directories    |
| **CI gate on visual diff**                  | $0                        | LIVE            | `e2e` job in `.github/workflows/ci.yml` fails PR if pixels diverge            |
| **PR comment with diff link**               | $0                        | LIVE ([R2])     | `.github/workflows/visual-review.yml` posts/updates a comment on failure      |
| **Linux-baseline capture workflow**         | $0                        | LIVE            | `.github/workflows/e2e-update-baselines.yml` (operator-dispatched)            |
| **Chromatic SaaS**                          | $0 OSS · paid for private | READY-TO-ENABLE | `Chromatic upload` step in `e2e` job; inert without `CHROMATIC_PROJECT_TOKEN` |

The free path covers the 80% case. Chromatic adds reviewer UX (cloud diff browser, "approve baseline" button, per-component history) — useful at team scale but not required.

## When a PR fails on visual

The `visual-review` workflow ([.github/workflows/visual-review.yml](../../.github/workflows/visual-review.yml)) posts a comment on the PR that:

- Links to the failed CI run.
- Tells the reviewer where to find the `playwright-report` artifact (HTML report with embedded expected/actual/diff PNGs).
- Documents the two fix paths (regression vs intentional change).

Updates the existing comment in place on retry — no spam.

### If the diff is intentional (UI change you want)

**Linux baselines diverge from macOS / Windows.** You CANNOT just regenerate locally on a non-Linux box.

**Preferred path:**

1. Open `Actions` → `e2e — update visual baselines` → **Run workflow** against your PR's branch.
2. The workflow runs Playwright with `--update-snapshots` on Linux, then opens a PR titled `chore(e2e): refresh visual baselines` containing the new PNGs + the `test.fixme` → `test` flip (if any).
3. Review that PR's PNG diffs in the GitHub UI. Merge it.
4. Re-run THIS PR's CI — visual checks pass against the new baselines.

**Local path (only when you ARE on Linux):**

```sh
pnpm --filter=web e2e:install
pnpm --filter=web e2e:update
git add apps/web/e2e/**/*-snapshots/
git commit -m "chore(e2e): refresh visual baselines"
```

### If the diff is a regression

Fix the UI in the same PR + push. The `e2e` job re-runs automatically; if pixels match the existing baseline, the gate goes green.

## Routes covered today

Every public route gets three checks (page renders + axe a11y + pixel diff). Live coverage:

| Route                  | Spec                                                              | Baseline file                                      |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `/`                    | [landing.spec.ts](../../apps/web/e2e/landing.spec.ts)             | `landing.spec.ts-snapshots/landing-above-fold.png` |
| `/help`                | [help.spec.ts](../../apps/web/e2e/help.spec.ts)                   | `help.spec.ts-snapshots/help-page.png`             |
| `/login`               | [login-flow.spec.ts](../../apps/web/e2e/login-flow.spec.ts)       | (no screenshot — interactive form)                 |
| `/account`             | [account-flow.spec.ts](../../apps/web/e2e/account-flow.spec.ts)   | (no screenshot — authenticated, user-state varies) |
| `/trips`               | [trips-empty.spec.ts](../../apps/web/e2e/trips-empty.spec.ts)     | (no screenshot — variable trip state)              |
| `/trips/new` flow      | [trip-flow.spec.ts](../../apps/web/e2e/trip-flow.spec.ts)         | (no screenshot — flow, not page)                   |
| Auth signup flow       | [auth-flow.spec.ts](../../apps/web/e2e/auth-flow.spec.ts)         | (no screenshot — flow)                             |
| a11y across all public | [accessibility.spec.ts](../../apps/web/e2e/accessibility.spec.ts) | n/a (axe)                                          |

Authenticated / dynamic pages skip pixel diff by design — user-state variance would create false positives. Visual regression coverage is **public, stable pages** + a11y on every route.

## Enable Chromatic (optional, operator-owed)

Chromatic adds a cloud UI where reviewers can:

- See expected/actual/diff side-by-side in a hosted UI (no artifact download).
- Click "Approve" on intentional changes — Chromatic propagates the new baseline.
- Track baseline history per component over time.
- Catch flakes Chromatic's internal de-dupe handles better than ours.

Cost: free for OSS repos; paid otherwise (starts at $149/month for closed source).

Setup:

1. Create a project at <https://www.chromatic.com>.
2. Copy the `projectToken`.
3. Add it as `CHROMATIC_PROJECT_TOKEN` in repo Settings → Secrets and variables → Actions → Repository secret.
4. The next PR's `e2e` job will upload to Chromatic automatically — the step is already in `ci.yml`, gated on the env var. No workflow edit needed.

To turn it off, delete the repo secret. The step goes inert.

## Why not Percy?

Same shape as Chromatic; Percy was acquired into BrowserStack and pricing went up. Chromatic + Playwright integration is the better default for a project that already uses Playwright.

## How baseline drift creeps in

- **Font rendering changes** between Chromium versions in the Playwright image. Manageable: pin the Playwright version (we do in `apps/web/package.json`).
- **Fly machine CPU contention** during CI — rare but happens; the `expect(...).toHaveScreenshot()` `maxDiffPixelRatio` config tolerates 0.5% deviation.
- **Locale / timezone differences** between dev box and Linux CI. Hidden in the `apps/web/playwright.config.ts` `use.locale` setting.

When a baseline starts flaking without an intentional UI change, walk up these three before assuming a bug.

## Operator-owed

1. Decide whether to enable Chromatic. The free path is genuinely sufficient for a 1-2 reviewer team.
2. If yes — drop `CHROMATIC_PROJECT_TOKEN` in repo secrets per above.
3. Schedule a quarterly baseline-refresh `workflow_dispatch` to absorb minor font / Chromium drift (cheap insurance against weekend flakes).

## See also

- [`apps/web/e2e/README.md`](../../apps/web/e2e/README.md) — local e2e workflow
- [`apps/web/playwright.config.ts`](../../apps/web/playwright.config.ts) — viewport + locale + retry config
- [`.github/workflows/e2e-update-baselines.yml`](../../.github/workflows/e2e-update-baselines.yml) — Linux baseline capture
- [`.github/workflows/visual-review.yml`](../../.github/workflows/visual-review.yml) — PR comment on failure
- [`docs/perf/capacity-matrix.md`](../perf/capacity-matrix.md) — where visual regression sits on the capacity / quality axis
