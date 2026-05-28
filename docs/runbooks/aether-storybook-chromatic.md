# Aether Storybook + Chromatic — operator bootstrap

> Scaffolded by AE4. One-time setup before the Chromatic CI gate can run for real.

## Local

```bash
# from repo root
pnpm install
pnpm --filter aether-storybook storybook
# opens http://localhost:6011
```

Stories cover:

- `Motion / Palette` — the Warm Italian palette, signal colours, semantic ramps
- `Motion / Typography` — the two-family text scale
- `Motion / Springs` — five named springs, "Play" button retriggers
- `Core / PremiumGate` — gating across {anonymous, free, plus, pro}
- `Canvas / AetherScene` — Drift composition, SunDisk solo, AmbientField solo

## Chromatic

1. Sign up at <https://www.chromatic.com> with the project's GitHub account.
2. Add a project; target `apps/aether-storybook` as the working dir.
3. Copy the project token Chromatic shows you.
4. In GitHub repo settings → **Secrets and variables → Actions**, add `CHROMATIC_PROJECT_TOKEN` = `<the token>`.
5. Push a branch that touches `packages/aether-*` or `apps/aether-storybook`. The `.github/workflows/aether-chromatic.yml` workflow runs and uploads the build; first run on `main` baselines all stories. Subsequent PRs diff against the baseline.

## Manual publish (no CI)

If you want to publish from your laptop instead:

```bash
pnpm --filter aether-storybook build-storybook
CHROMATIC_PROJECT_TOKEN=<token> pnpm --filter aether-storybook chromatic
```

## Cost

Chromatic free tier: 5000 snapshots / month. We have ~10 stories × ~3 viewports = ~30 snapshots per CI run; ~150 runs/month before hitting the cap. Plenty for Phase 0-1.
