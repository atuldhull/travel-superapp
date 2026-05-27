# 02 — Surfaces (the ten pillars)

> Aether doesn't have pages or screens. It has **surfaces** — persistent 3D scenes you navigate between. Each surface is a fully-articulated visual + audio + interaction language; together they cover the entire user journey.

## Map

| #   | Surface       | Replaces (1.0)                                          | Phase |
| --- | ------------- | ------------------------------------------------------- | ----- |
| 1   | **Drift**     | `/` home, feed                                          | 1     |
| 2   | **Genie**     | (new) voice + camera modal                              | 2     |
| 3   | **Atlas**     | `/trips/[id]` and sub-routes                            | 1     |
| 4   | **Lumen**     | `/memory-books/[id]` and edit                           | 2     |
| 5   | **Compass**   | navigation, maps, AR                                    | 1 + 3 |
| 6   | **Echo**      | `/feed`, social discovery                               | 3     |
| 7   | **Pulse**     | (new) always-present AI                                 | 1     |
| 8   | **Vault**     | `/pricing`, `/account/billing`, future booking surfaces | 2     |
| 9   | **Mirror**    | `/admin/*` — operations / forensics                     | 3     |
| 10  | **Continuum** | (new) cross-device handoff                              | 5     |

---

## 1. Drift — home / discovery

You land here. The screen is a softly-lit 3D space; in the foreground floats one **Now Card** (what to do RIGHT NOW based on time/place/persona). Behind it, deeper into the scene, drift smaller **Soon Cards** (upcoming trips, saved places). Even further back: **Echoes** (your followed travellers' recent trips, glowing faintly).

You move the camera by scrolling (web) or by tilting the phone (mobile gyroscope). The cards parallax. The audio key signature is the destination of your nearest upcoming trip (or your home city's signature if no trip).

Tap a card → it **transforms** into the next surface, not navigates. The Atlas materialises from this card with continuity of motion.

**Tech:** R3F particle field background (10k GPU instances), 5 layers of parallax cards, CSS Houdini palette gradient bound to time-of-day, Tone.js continuous drone in the destination's key.

**Data sources:** `useTripControllerList` (existing), `usePublicMetricsControllerGet` (existing), `useFeedController*` (existing apiFetch direct).

---

## 2. Genie — voice / camera modal

Hold the **Pulse** (#7). The current surface dissolves into ~5000 particles that swirl into the lower third. A waveform appears. You speak. The transcription writes itself in real-time across the top — but it's not text in a textbox; it's _typeset_ in 3D space, each word a floating glyph.

When you stop speaking, the AI processes (Pulse breathes faster), and the new surface composes itself **out of those particles** — the words become places, the places become cards, the cards lock into a new Atlas.

Camera mode (point at menu / landmark / price tag): same particle dissolution, but the camera feed becomes the lower layer; AR-style overlays render in 3D above. ML Kit / Vision detects in real-time.

**Tech:** GPU particle system (R3F + custom GLSL), Whisper STT streaming, custom WebGL text-as-mesh renderer, mediapipe / Vision Framework, ElevenLabs TTS streaming back.

**Data sources:** ai-service `/v1/transcribe` (S-A3 stub today; real with `pip install '.[stt]'`), ai-service `/v1/translate` (S-A2), trip + place SDK hooks.

---

## 3. Atlas — trip studio

Replaces `apps/web/src/app/trips/[id]/page.tsx` (which is ~1300 lines of Tailwind today).

The destination's skyline is rendered in 3D, hovering above a horizontal timeline. The timeline is the trip duration; days are stations along it. Above each day station floats a stack of **PlaceOrbs** (each saved place is an orb, sized by your interest, colored by category).

Drag an orb from the map → it travels in a physics-accurate arc to the day. Drag between days → smooth interpolation. Rearrange the day order by grabbing a day station and physically rotating the timeline.

The day's weather is **rendered as ambient particles** in the scene (rain = vertical streaks; sunny = warm bloom; storm = visible front rolling across).

The AI Companion (#7) sits at the bottom corner; when you make a decision it can comment on, it briefly brightens. Tap → it speaks.

**Tech:** R3F scene, Cannon-es physics for orb dragging, Skia text rendering for the timeline labels, weather-driven shaders, AI persona embedding informs which orbs glow.

**Data sources:** every trip / place / weather hook in `@app/sdk`. yjs CRDT for collaborative editing.

---

## 4. Lumen — memory studio

Photos float in 3D space, sorted by capture time on a horizontal axis and by your **rating** on a vertical axis (high-rated photos float to the top of the cloud).

Pinch-zoom (mobile) or scroll-pinch (web) to enter a single photo. The photo becomes a wall; the rest of the trip's photos arrange themselves in 3D around it like a museum.

**Auto-arrange** uses CLIP embeddings (ai-service): point at any photo, say "arrange by mood" or "by who's in the photo" or "by color" and the cloud reorganises with physics-accurate flow.

PDF export (T1-W.3 / S-B4) renders this scene to a print-ready static composition.

**Tech:** R3F + drei `Html` for photo planes, ai-service CLIP-style embeddings (new endpoint or reuse `/v1/embeddings` with photo features), physics-based clustering, Skia mobile equivalent.

**Data sources:** `useMediaControllerListByTrip` (existing), `useMemoryBookController*` (existing).

---

## 5. Compass — navigation

Replaces every map and direction view. Two modes:

**Bird** (desktop / planning): top-down 3D city block render with realistic building heights (Mapbox 3D buildings + custom shader for time-of-day lighting). Your route is a glowing path; alternative routes are dimmer paths; the AI Companion narrates aloud the trade-offs.

**Eye** (mobile / in-trip): camera passthrough with floating AR arrows; the next 3 directions stack vertically in the air ahead of you; turn the camera and they re-orient. Compass needle is a real 3D needle that points to your next waypoint, magnetically.

Public-transport mode: the bus / train is rendered as a small icon traveling along its route in real-time (GTFS feed); you see your bus 4 minutes away.

**Tech:** Mapbox / MapLibre 3D, AR via WebXR (web) + ARKit/ARCore (mobile via `react-native-arkit` / `expo-three`), GTFS real-time feeds.

**Data sources:** `useTransportControllerRoutes` + `useTransportControllerNavigation` (both wired via S-Ct).

---

## 6. Echo — social feed

Vertical-scroll TikTok-style, but it's not just videos. Each "echo" is one moment from someone's trip: a photo + 1-sentence diary entry + the place's PlaceOrb. Swipe up = save the place to your trip. Swipe right = follow the traveller. Long-press = ask the AI "plan me a trip like this."

The **palette of the entire screen** continuously re-derives from the current echo's photos. As you scroll, the world re-tints in real-time.

Audio: each echo plays a 5-second ambient bed mixed from the destination's key signature + the dominant photo's color → a unique 5-sec composition per echo.

**Tech:** WebTransport for low-latency feed delivery, real-time photometric analysis via WebGPU compute shader, Tone.js procedural ambient generation.

**Data sources:** `useFeedController*` (existing, currently `apiFetch` direct), `useSocialGraphController*` (existing).

---

## 7. Pulse — the always-present AI

A 60-pixel soft glow in the corner of every surface. Idle = gentle 8-second breathing cycle. Listening = faster, brighter. Speaking = visible audio-amplitude pulse. Sleeping (low battery / user inactive) = dim, almost gone.

You can _throw_ a card at the Pulse — physically drag any card toward the corner and the AI receives it ("what do you think of this place?"). The Pulse swallows the card with a particle burst, processes, returns a comment as overlay text.

The Pulse remembers — your **persona embedding** is updated from every interaction. Over 30 trips, the Pulse's responses become uncannily aligned with your taste.

**Tech:** R3F custom shader with breathing math, persistent web component so it survives route changes, ai-service persona embedding (Tier 4 T4-Ag.1 from the v2 menu), ElevenLabs cloned voice for premium users.

**Data sources:** all ai-service endpoints, plus a new `User.personaEmbedding` column (Prisma additive migration, follows the playbook's data-model rules).

---

## 8. Vault — bookings + commerce

Replaces `/pricing`, `/account/billing`, future booking surfaces.

A vault-like environment: prices float as **weighted glyphs** (heavier price = larger, denser glyph; price drops over time = glyphs lighten visibly). A 7-day forecast of price history is a horizontal line below each glyph; future predictions (from Tier 4 T4-Pr.1) extend as ghost lines.

Tap a price glyph → it _opens_ (literally — the glyph splits and unfolds into the booking flow). Stripe Checkout iframe is wrapped in our material so it doesn't feel like a third-party redirect.

**Tech:** Custom physics for glyph weight, Stripe Elements with custom styling, Tier 4 T4-Pr.1 prediction line, Skia path animation.

**Data sources:** `usePaymentsController*` (existing — already fully wired in 1.0, operator-owed env), `useStaysControllerSearch` + `useTransportControllerRoutes` (booking targets).

---

## 9. Mirror — admin forensics

Operations get their own surface. The current admin (the 6 queues + SLA dashboard + agent-KYC queue we shipped in S-E1..E7) is rebuilt as a single canvas:

- Live SOS events render as red dots on a globe, pulsing.
- Pending scam reports cluster geographically; clusters bigger = more reports.
- The audit log streams as a vertical river on the right edge; each row is a small floating glyph that disappears after 60s.
- "Investigate user" command (admin Cmd+K) → the user's entire context (trips, reviews, audit-mentions, payments) **assembles** in real-time from the river into a forensic dashboard.

The Slack notifier (S-E6) fires for every critical mutation; on Mirror, you also see a visible spark on the audit river at the same instant.

**Tech:** R3F globe with GeoJSON country borders, WebTransport stream for the audit river, instant-search via Meilisearch index over admin actions.

**Data sources:** every `useAdmin*Controller*` hook (S-E5 family + earlier admin surfaces).

---

## 10. Continuum bar — handoff

Always visible on the edge of the screen as a single subtle line. Tap → shows your current surface state encoded as a QR.

Another device sees the same line; tap → "continue here?" → instant transfer. The Atlas you were composing on phone reappears on desktop _with the same orb positions, same camera angle, same scroll_.

Watch (Apple) shows the next-action glyph from your current Atlas as a complication. Tap the watch → opens the phone to that exact step.

**Tech:** WebTransport for state sync, Apple Continuity APIs (mobile), QR with deep-link fallback, Web Share API.

**Data sources:** new `continuum` Redis channel (uses existing Redis cluster posture from Q2); no new API endpoint needed.

---

## How surfaces compose

Every surface obeys the same lifecycle:

1. **Materialise** — particles assemble from the previous surface's residue + the new surface's data manifest.
2. **Settle** — physics dissipates; audio key signature crossfades; palette tween completes.
3. **Listen** — user input (gaze, gesture, voice, keyboard, touch) drives the surface's primary loop.
4. **Anticipate** — Predictor pre-warms the next likely surface in OPFS.
5. **Dissolve** — particles scatter to seed the next surface's materialisation.

All five steps are choreographed on the same global timeline. There is no surface boundary the user can perceive as a "page load."

## See also

- [`01-architecture.md`](01-architecture.md) — the runtime layers each surface uses.
- [`03-tech-stack.md`](03-tech-stack.md) — exact libraries.
- [`04-sequencing.md`](04-sequencing.md) — phase mapping for each surface.
