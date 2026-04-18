# TravelSuperApp

Mobile-first, AI-powered travel super-app. A user enters a place + radius; the app generates a full itinerary (places, stays, food, events, transport, weather, crowd, safety, prices, translation, 3D previews) and stays with them through the trip with live re-planning.

## Authoritative docs

| File                                                     | Purpose                                              |
| -------------------------------------------------------- | ---------------------------------------------------- |
| [`travel-app-playbook.md`](./travel-app-playbook.md)     | The book — architecture, conventions, phases.        |
| [`travel-app-playbook.html`](./travel-app-playbook.html) | Shareable viewer of the book.                        |
| [`travel-app-prompts.md`](./travel-app-prompts.md)       | Prompt archive — one prompt per Playbook subsection. |
| [`CLAUDE.md`](./CLAUDE.md)                               | System rules for AI agents working on this repo.     |
| [`PROGRESS.md`](./PROGRESS.md)                           | Rolling log of completed prompts.                    |

## Quickstart

```bash
# One-time
corepack enable   # on Windows may need admin; otherwise use: npx pnpm <cmd>

# Install + run
pnpm install
pnpm dev
```

Requirements: Node **22+** (`.nvmrc`), pnpm **9+** (`package.json#packageManager`), Git.

## Structure

```
apps/
  api/                   NestJS modular monolith
  web/                   Next.js 15 (user-facing)
  admin/                 Next.js 15 (internal ops)
  mobile/                React Native + Expo 51
  ai-service/            Python FastAPI (NOT in pnpm workspace)
  media-service/         Node Sharp worker
  notification-worker/   NestJS standalone + BullMQ
  crawler-worker/        NestJS standalone + Playwright

packages/
  shared-types/          Zod schemas + TS types (single source of truth)
  ui/                    shadcn + Tailwind (web)
  mobile-ui/             Tamagui (RN)
  sdk/                   Auto-generated API client
  logger/                Pino wrapper with trace context
  config/                Zod-validated env
  errors/                Domain error hierarchy
  observability/         OTel + metrics + Sentry
  eslint-config/         Shared flat ESLint config
  tsconfig/              Base tsconfig variants

infra/                   docker-compose, k8s, terraform (scaffolded later)
docs/                    ADRs, runbooks, onboarding, block retrospectives
.github/workflows/       ci, cd, security, preview, release (scaffolded later)
```

## Commands

| Command                 | What it does                        |
| ----------------------- | ----------------------------------- |
| `pnpm dev`              | All apps in parallel (Turbo).       |
| `pnpm build`            | Production build.                   |
| `pnpm lint`             | ESLint across the monorepo.         |
| `pnpm typecheck`        | TypeScript across the monorepo.     |
| `pnpm test`             | Unit tests.                         |
| `pnpm test:integration` | Integration tests (Testcontainers). |
| `pnpm format`           | Prettier write.                     |

## Execution workflow

See [`CLAUDE.md`](./CLAUDE.md). One prompt per session from [`travel-app-prompts.md`](./travel-app-prompts.md). Commit format: `<type>(<prompt-id>): <summary>`, e.g. `chore(II.10.0): scaffold monorepo`.

## License

Proprietary — all rights reserved. Do not redistribute.
