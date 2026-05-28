# Runbook — mobile EAS bootstrap

> **Installed by [S-D5]** of the S-series real-functionality closeout. Companion to [`apps/mobile/eas.json`](../../apps/mobile/eas.json) + [`.github/workflows/mobile-eas-build.yml`](../../.github/workflows/mobile-eas-build.yml).
>
> Closes the Z1 mobile-audit "no EAS config, no App Store / Play Console" ship-blocker. After this runbook, the operator can dispatch builds via the GitHub Actions UI and submit to TestFlight / Play Internal.

## One-time setup

```sh
# Inside apps/mobile/ — the workspace is isolated per
# [[expo-react-workspace-collision]] memory note.
cd apps/mobile
pnpm install --ignore-workspace

# Login + create the EAS project. Writes the project id into app.json.
eas login
eas project:init --non-interactive

# Configure credentials interactively (iOS distribution cert + APNs key +
# Android keystore). EAS stores these encrypted on Expo's servers.
eas credentials
```

## Required GitHub secrets

Repo → Settings → Secrets and variables → Actions:

| Secret                | What                                              | How to get                                                                                                                  |
| --------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_TOKEN`          | EAS CLI auth (read + build + submit)              | `eas whoami --token` (or Expo Dashboard → Settings → Access Tokens)                                                         |
| `APPLE_TEAM_ID`       | Apple Developer team id (10-char alphanumeric)    | Apple Developer Portal → Membership → Team ID                                                                               |
| `APPLE_ASC_APP_ID`    | App Store Connect app id (numeric)                | App Store Connect → My Apps → app → App Information → Apple ID                                                              |
| `GOOGLE_PLAY_SA_JSON` | Play Console service-account JSON, base64-encoded | Play Console → Setup → API access → Create service account → grant Release Manager → download JSON. `base64 -w0 < key.json` |

## Triggering a build

### Via GitHub Actions UI

1. **Actions → mobile-eas-build → Run workflow**.
2. Pick `profile` (development / preview / production).
3. Pick `platform` (ios / android / all).
4. Run. The workflow dispatches the build to EAS; track progress on the EAS dashboard.

### Via push

Any push to `main` that touches `apps/mobile/**` automatically dispatches a `preview` channel build for both platforms.

## Build profiles

Defined in [`apps/mobile/eas.json`](../../apps/mobile/eas.json):

| Profile       | Distribution | Channel       | API base                             | Purpose                                                    |
| ------------- | ------------ | ------------- | ------------------------------------ | ---------------------------------------------------------- |
| `development` | internal     | `development` | `EXPO_PUBLIC_API_BASE_URL` (local)   | Dev client; pairs with `expo start --dev-client`.          |
| `preview`     | internal     | `preview`     | `https://travel-api-staging.fly.dev` | TestFlight + Play Internal. Auto-increments build number.  |
| `production`  | store        | `production`  | `https://travel-api-prod.fly.dev`    | App Store + Play Production. Auto-increments build number. |

## Submitting to stores

After a successful `preview` build:

```sh
eas submit --platform ios --profile preview --latest
eas submit --platform android --profile preview --latest
```

After a `production` build (release candidate):

```sh
eas submit --platform all --profile production --latest
```

The `submit` profiles in `eas.json` reference the GitHub-secrets-supplied team / asc / service-account values; no further interactive input needed.

## OTA updates (post-launch)

EAS Update ships JS-only patches without a store re-review. Once the production app is live:

```sh
eas update --channel production --message "hotfix: X"
```

Native code changes still require a fresh store build.

## What's intentionally NOT in this slice

- **APNs key + FCM credentials uploaded.** Operator runs `eas credentials` interactively once; the GitHub Actions workflow only needs the public-facing secrets (TEAM_ID / ASC_APP_ID / SA_JSON), not the iOS dist cert itself.
- **Privacy manifest + App Store metadata.** Both Apple-mandatory before public launch; lives in the App Store Connect UI, not in this repo.
- **Mobile push-token backend register endpoint.** [S-D4] wires the Expo push token client-side but the api needs a new `POST /notifications/expo-token` route to associate it with `User.id`. Tracked as a backend follow-up.

## Operator checklist (one-time)

- [ ] Apple Developer Program enrolled ($99/yr).
- [ ] Google Play Console account ($25 one-time).
- [ ] `eas project:init` run; project id committed to `app.json`.
- [ ] APNs key uploaded via `eas credentials`.
- [ ] FCM service-account JSON uploaded via `eas credentials`.
- [ ] Repo secrets set (4 entries above).
- [ ] First `preview` build dispatched + downloaded to TestFlight / Play Internal.
- [ ] iOS Universal Links domain verification — `apple-app-site-association` hosted at `https://travelsuperapp.local/.well-known/`.
- [ ] Android App Links domain verification — `assetlinks.json` at the same path.

## See also

- [`apps/mobile/eas.json`](../../apps/mobile/eas.json) — profile definitions.
- [`.github/workflows/mobile-eas-build.yml`](../../.github/workflows/mobile-eas-build.yml) — the CI workflow.
- [`docs/audit/mobile-2026-05-26.md`](../audit/mobile-2026-05-26.md) — Z1 audit that flagged this gap.
- [Expo docs — EAS Build](https://docs.expo.dev/build/introduction/) — upstream reference.
