# ADR-005 — Frontend stack: Next.js 15 + React Native (Expo 51) + TS strict + shadcn/Tailwind + Tamagui

- **Status:** Accepted
- **Date:** 2026-04-19
- **Prompt:** `[II.8.1]`
- **Playbook reference:** §8.1

## Context

Playbook §3 commits TravelSuperApp to web (marketing + planner-desktop + admin) AND mobile (iOS + Android) from day one. That's two render targets, and the naïve path is two codebases with independent component systems, independent lint configs, independent auth / i18n / analytics wiring. Pre-PMF that's a strict loss — every feature costs 2× to ship, and the two implementations drift.

This ADR locks the frontend stack so that feature authors don't relitigate "Next.js vs Remix" or "Tailwind vs CSS Modules" in every PR.

## Decision drivers

- **One TypeScript universe.** Types and Zod schemas from `@app/shared-types` / `@app/sdk` must be importable from web AND mobile without a compile shim. Rules out language-level forks.
- **SSR + SEO for marketing and public trip shares.** Public pages (`/trip/:shareCode`, marketing, agent profiles) are rendered server-side so they're crawlable. Non-negotiable.
- **Native feel on mobile.** Users expect 60 FPS scrolling + OS-native gestures + push + offline. Rules out pure-web wrappers (PWA-only, Capacitor, Ionic).
- **OTA updates on mobile.** Shipping a fix through App Store review for every bug is untenable. Need a platform that supports over-the-air JS bundle updates.
- **Small team.** 1–3 engineers. Any "you need a dedicated build engineer" stack is disqualified.
- **Design system reuse.** The same Button / Card / EmptyState shouldn't be implemented twice. Primitives should be sharable as far into the tree as the platform allows before diverging at the leaf.

## Considered choices (each locked, each with one rejected alternative)

### 1. Web framework — **Next.js 15** (App Router, RSC, Server Actions)

**Chosen.** App Router gives us React Server Components + streaming SSR by default; Server Actions handle mutation paths without a separate API route per form; Edge runtime lets us colocate auth / rate-limit logic at the CDN edge.

**Rejected alternative: Remix / React Router 7.** Excellent framework with a cleaner mental model for forms and loaders — but shipping marketing pages on Edge with granular server-component streaming in April 2026 is still stronger in Next. Our specific hot paths (public trip shares rendered at the edge with partial data freshness) lean on App Router features we'd have to recreate in Remix. Re-evaluate if the RSC story evolves elsewhere.

### 2. Mobile runtime — **React Native + Expo 51** (EAS, expo-router)

**Chosen.** RN gives us native views (not a webview), true 60 FPS, and the broadest native-module ecosystem. Expo's managed workflow eliminates the Xcode / Android Studio build-setup tax; EAS Build + EAS Update gives us cloud builds + OTA JS updates; expo-router gives us file-based routing that mirrors Next.js App Router, so devs move between web and mobile with low ceremony.

**Rejected alternative: Flutter.** Tempting because of the Skia-backed rendering consistency, but the language fork (Dart) would break our "one TypeScript universe" rule. We'd lose direct import of `@app/sdk`, be unable to share Zod schemas without codegen, and the team has zero Dart experience. A pure rendering-consistency argument isn't enough to justify a second compiler toolchain.

### 3. Language — **TypeScript strict**, end-to-end

**Chosen.** `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride`. Same config inheritable via `@app/tsconfig` across every workspace (api, web, admin, mobile, workers). Zero `any` allowed anywhere (CLAUDE.md rule 9).

**Rejected alternative: Gradual TypeScript (`strict: false` + allow-js).** Classic startup default, and it does let you ship faster for the first two weeks. But the types on a pre-PMF codebase are the documentation. Gradual TS produces a long tail of half-typed surfaces that no one ever goes back and fixes, and the cost at month 6 dwarfs the savings at week 2. Committing to strict from day 0 keeps the team honest.

### 4. Web styling / components — **Tailwind CSS + shadcn/ui**

**Chosen.** Tailwind for atomic styling (no runtime cost, utility-first, survives CSS-in-JS churn), shadcn/ui for copy-paste accessible primitives that live inside our repo rather than being a vendored dependency. We OWN the components — bumping Radix Popover or adding a variant is a local edit, not a package upgrade.

**Rejected alternative: MUI v6.** Heavier, opinionated Material design, harder to re-theme for our brand. A Material-looking travel app is a non-starter — every competitor looks the same. And MUI's runtime emotion CSS conflicts with our RSC goals (server-side rendering CSS-in-JS is still a perf cliff in App Router).

### 5. Mobile styling / components — **Tamagui**

**Chosen.** Compiles to StyleSheet at build time → zero runtime style parsing → no FPS drop. Has a web adapter so the same `<Button size="md" theme="primary">` renders in Next.js (web) and RN (mobile); we aim for leaf-component parity where the platform permits. Ships its own design-token system that we configure in `@app/mobile-ui`.

**Rejected alternative: NativeWind (Tailwind for RN).** Most direct port of our web styling philosophy, but it parses Tailwind classes at runtime on each render pass — measurable FPS drop on long lists (trip feed, memory book). Tamagui's compile-time optimisation is the correct tradeoff for a scroll-heavy mobile app.

## Summary

| #   | Layer                    | Chosen                        | Rejected (one)         |
| --- | ------------------------ | ----------------------------- | ---------------------- |
| 1   | Web framework            | Next.js 15 (App Router + RSC) | Remix / React Router 7 |
| 2   | Mobile runtime           | React Native + Expo 51        | Flutter                |
| 3   | Language                 | TypeScript strict, end-to-end | Gradual TypeScript     |
| 4   | Web styling + components | Tailwind + shadcn/ui          | MUI v6                 |
| 5   | Mobile styling           | Tamagui                       | NativeWind             |

## Consequences (binding)

- **Every TS surface inherits from `@app/tsconfig`.** `strict: true` is not negotiable per-package. Superseding this ADR is the only way to relax.
- **No framework co-existence.** `apps/web` is Next.js; `apps/mobile` is Expo. No Vite escape hatch; no Capacitor wrappers. If a new surface needs a third option, supersede this ADR.
- **Component primitives live in two places ONLY:** `@app/ui` (web, shadcn + Tailwind) and `@app/mobile-ui` (mobile, Tamagui). No component lives in `apps/web` directly unless it's a route-specific composition.
- **Mobile ships OTA updates via EAS Update by default.** Native-module changes trigger a new store submission; JS-only changes do not. The release flow in `[IX.32.x]` assumes this.
- **PWA is NOT our mobile story.** The web app installs to home screen but is not the primary mobile experience. Native apps are the product.

## Re-evaluation triggers

This ADR is reviewed if any of the following becomes true:

- React Server Components reach stable parity in a Next-alternative we'd actually pick (Remix, Waku).
- Tamagui maintenance slows materially or its web adapter drops parity.
- A platform-native requirement (e.g. Apple Vision Pro, Wear OS) forces a third render target.
- Our team grows past ~20 engineers, at which point splitting the web+mobile stack may be cheaper than maintaining a shared component system.

## Links

- Playbook §8.1 (Frontend table).
- Sibling ADRs: [ADR-006 Backend stack](./ADR-006-backend-stack.md) (pending), [ADR-007 Data layer](./ADR-007-data-layer.md) (pending).
- [package-manifest](../packages/manifest.md) — `@app/ui` web-only, `@app/mobile-ui` mobile-only, `@app/tsconfig` everywhere.
- [Next.js App Router](https://nextjs.org/docs/app) · [Expo EAS](https://docs.expo.dev/eas/) · [shadcn/ui](https://ui.shadcn.com/) · [Tamagui](https://tamagui.dev/).
