# apps/web — Next.js 15 user-facing app

> Scaffold installed by `[IV.18.19.14]`. Companion to
> [`docs/onboarding.md`](../../docs/onboarding.md).

## What's here today

- **App Router** (`src/app/`) — `layout.tsx` + `page.tsx` (landing) +
  `featured/page.tsx` (server-side fetch from the api's
  `/api/v1/memory-books/featured`).
- TypeScript strict, React 19, Next 15.

## What's NOT here yet

- Design system — Tailwind / shadcn / Tamagui pick lives in `[IV.18.20.x]`.
- Auth UI — login / register / OAuth round-trip.
- Trip planner UI.
- SDK consumption from `packages/sdk` (not yet generated; see
  [`docs/api/README.md`](../../docs/api/README.md) for the orval roadmap).

These iterate after the deploy gate is green; the goal of this
scaffold is to prove the fetch + SSR + monorepo build path works
end-to-end.

## Run

```sh
# In one terminal: boot the API.
pnpm --filter=api dev

# Optional: populate demo data so /featured returns rows.
pnpm --filter=api db:seed:demo

# In another terminal: start the web app on :3001.
pnpm --filter=web dev
```

Open [http://localhost:3001](http://localhost:3001).

## Env

| Var       | Default                 | What                                                                            |
| --------- | ----------------------- | ------------------------------------------------------------------------------- |
| `API_URL` | `http://localhost:3000` | Base URL the SSR fetches use. Set to the staging / prod Fly URL when deploying. |

## Build

```sh
pnpm --filter=web build
pnpm --filter=web start
```

A real Dockerfile lands when web has a deploy story (likely
Vercel for v1; Fly.io for symmetry with the api in v2).
