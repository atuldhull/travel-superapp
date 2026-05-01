# mobile — TravelSuperApp Expo client

Installed by prompt **V.UX.27**.

Stack: Expo 51 · Expo Router · Tamagui · React Native 0.74 · React 18.2.

## Install + run

This package is **deliberately excluded** from the root pnpm workspace
(see [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)) because
Expo 51 transitively pins `@types/react@18` and `react@18.2`, which
collides with the Next.js 15 / React 19 baseline used by `apps/web`.

Install + run from this directory:

```bash
cd apps/mobile
pnpm install --ignore-workspace
pnpm start
```

`@app/sdk` is wired via a relative `link:../../packages/sdk` so the
shared OpenAPI client + types still come from the workspace.

## Routes

Expo Router file-based routing under `app/`:

```
app/
  _layout.tsx                — Stack root, providers, SDK boot
  (tabs)/
    _layout.tsx              — bottom tab bar
    trips.tsx                — caller's trips (mirrors web /trips)
    explore.tsx              — discover + near-me launchpad
    inbox.tsx                — V.UX.26 inbox surface
    profile.tsx              — whoami + sign-out
  trips/[id].tsx             — trip detail w/ offline banner
  memory-books/[id].tsx      — memory-book reader
  login.tsx                  — password sign-in
```

Deep-link scheme: `travelapp://...` + Universal Links via
`travelsuperapp.local` (configured in `app.json`).

## Offline behaviour

`react-query`'s persisted cache (AsyncStorage) is configured in
`lib/offline-cache.ts`. The trip detail screen + the trips list
render the last-fetched data when the device is offline, with an
amber banner.

## Re-add to workspace

When this project's web baseline supports React 18 OR Expo 52
(React 19) is the mobile baseline, drop the `'!apps/mobile'` line
from `pnpm-workspace.yaml`, drop `apps/mobile/.npmrc`, and switch
`@app/sdk` back to `workspace:*`.
