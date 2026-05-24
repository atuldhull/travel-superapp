# Playwright E2E

| Spec                    | Auth | What it tests                                                |
| ----------------------- | ---- | ------------------------------------------------------------ |
| `landing.spec.ts`       | —    | `/` loads · axe-clean · visual baseline (above-the-fold)     |
| `accessibility.spec.ts` | —    | `/accessibility` loads · axe-clean                           |
| `help.spec.ts`          | —    | `/help` loads · axe-clean · visual baseline (full page)      |
| `auth-flow.spec.ts`     | UI   | Signup form → `/trips` redirect · register page axe-clean    |
| `login-flow.spec.ts`    | UI   | API-registered user logs in via /login form → `/trips` · axe |
| `trip-flow.spec.ts`     | UI   | Signup → `/trips` → `/trips/new` composer reachable          |
| `trips-empty.spec.ts`   | UI   | Fresh user sees empty state OR "new trip" CTA on `/trips`    |
| `account-flow.spec.ts`  | UI   | Signup → `/account` settings renders · `/account` axe-clean  |

Each test gets a unique account via
[`helpers/auth.ts`](./helpers/auth.ts) (crypto-random email; no
`Date.now()` collisions). `helpers/auth.ts` also exports
`registerViaApi()` for tests that want a session without driving
the signup form (e.g. `login-flow.spec.ts`).

## Running locally

```bash
# 1. Boot dependencies (Postgres + Redis)
pnpm dev:up

# 2. Install Playwright browsers (one-time)
pnpm --filter=web e2e:install

# 3. Run the full suite
pnpm --filter=web e2e
```

The Playwright `webServer` config in
[`../playwright.config.ts`](../playwright.config.ts) auto-spawns
both the api (port 3000) and the web (port 3001) as part of the
test run.

## Visual baselines

Visual regression tests use `expect(page).toHaveScreenshot()`. The
baselines live next to the spec under `<spec>-snapshots/` and are
platform-sensitive — **Linux Chromium pixel output differs from
macOS / Windows.** Local screenshots are NOT committable; only
baselines captured on the Linux CI runner are valid.

### First-time capture / refresh after an intentional UI change

1. In GitHub Actions, click "e2e — update visual baselines" →
   "Run workflow".
2. The workflow runs Playwright with `--update-snapshots` on Linux
   and opens a PR titled `chore(e2e): refresh visual baselines`.
3. Eyeball the PNG diffs in the PR. Merge if intended.
4. The flip from `test.fixme` → `test` is part of the same PR —
   the regular `e2e` job in `ci.yml` enforces the new baselines
   on every PR after merge.

### Why `test.fixme` on the visual tests today

The very first run of this repo has no baselines committed yet.
`test.fixme` skips the visual assertions until the operator
triggers the workflow above and merges its PR. Functional + axe
gates ARE live on this commit; only pixel-level enforcement waits
on baselines.

## SaaS alternative — Chromatic

`ci.yml`'s `e2e` job has an optional Chromatic upload gated on the
`CHROMATIC_PROJECT_TOKEN` secret. When set, builds also push to
Chromatic for hosted visual review. Inert without the key — $0
/no-key default.
