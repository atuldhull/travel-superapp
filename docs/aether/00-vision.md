# 00 — Vision

> **Aether is the 2.0 frontend.** Not "the next major version." A different category of product. The phone camera and voice are the primary inputs. The AI doesn't just answer questions — it watches the trip and acts. Memory becomes a living artefact. Other travellers' trips inform yours through a feed that's algorithmic and procedurally-themed, not chronological and grid-laid-out.

## Thesis

**Today (1.0):** a competent travel-planning app. AI plans an itinerary, you edit it, you share it, you collect memories. The plumbing is real (workers, queues, audit log, RBAC); the UI is functional but generic; bookings happen via referral / out-of-band.

**Aether (2.0):** a _spatial computing_ travel companion. The phone is the canvas. The AI is a co-pilot, not a tool. The interface composes itself per user, per data, per mood. Bookings happen inside the app.

## What "10 years ahead" means (concretely)

| Today's frontier (2026)     | Aether (target)                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Bento grids of cards        | **Spatial canvas** — every screen is a 3D scene with depth, parallax, real lighting                                                     |
| Click → page → click → page | **Generative layout** — the page composes itself per-user, per-data, per-mood                                                           |
| Chatbot in a panel          | **Ambient AI** — a glowing entity in the corner, breathing, watching, never spoken-to-by-button                                         |
| Light/dark theme            | **Procedural palette** — every destination's photos are clustered into a unique gradient that bleeds across every surface for that trip |
| 60fps animations            | **120fps motion choreography** — GSAP + R3F + Skia + Reanimated 3 all on a shared timeline                                              |
| Lottie microinteractions    | **Living surfaces** — WebGPU compute-shader backgrounds that breathe with real data (crowd density at a place → pulse rate of its dot)  |
| Tap to open                 | **Predictive prefetch** — on-device ML watches your gaze / scroll / tap cadence and the next surface is already there                   |
| Click to type               | **Voice + camera + gesture first** — keyboard is a fallback, not the default                                                            |
| Stateless pages             | **Emotional state mirror** — UI tempo, color, and density respond to your tap cadence (frustrated user → calmer surface)                |
| One device at a time        | **Continuum** — start on watch, hand off to phone via QR, finish on web; literal animation handoff                                      |
| Sound design = button click | **Tonal layer** — every interaction has a unique sound; the app has a key signature per destination                                     |
| Static photos               | **Real-time photometric** — every photo is parsed live for color, mood, weather; the UI re-tints from it                                |

This isn't "polish." It's a different category of product. The closest existing comparison is what Apple did with Vision Pro's interaction model — **but flatter, faster, and not requiring a $3500 headset.**

## Six principles

### 1. Spatial > Hierarchical

Information isn't in pages or screens. It's in _space_. Cards float, drift, and lock. You navigate by moving through a scene, not by clicking links. Even the keyboard-driven web version maintains this — the cursor moves through 3D space rendered as flat to satisfy CSS.

### 2. AI is presence, not a tool

No "open chat" button. The AI is always there, visible, watching, occasionally suggesting. It pulses faster when active, slower when idle, ambient otherwise. Think "Samantha" from _Her_, not "ChatGPT in the corner."

### 3. Living, never static

No pixel is still. Backgrounds breathe. Cards subtly drift. Text has a 200ms re-flow when the underlying data updates. The app feels alive even when you're not interacting. Battery / motion-sensitivity opt-out is first-class.

### 4. Camera + voice + gesture first

On mobile, the default action is "point" or "speak," not "type." On web: webcam-aware gestures (wave to dismiss, pinch in mid-air to zoom — using `mediapipe` hand tracking). The keyboard is a fallback, not the default.

### 5. Predictive everything

Every surface preloads its next likely surface. Every form's next field is pre-filled with the AI's best guess (you confirm; you don't compose). The transition from "click" to "next surface rendered" is **17ms target** (one frame at 60Hz, sub-frame at 120Hz).

### 6. Emotional resonance over information density

A page that conveys _the feeling_ of being in Lisbon is better than a page that tells you 12 facts. Photos breathe, sound plays softly, ambient color shifts. The Italian Riviera screen has different motion physics from the Tokyo screen.

## Non-goals (explicit)

- **Not a Booking.com clone.** We don't own inventory; we orchestrate it.
- **Not a TikTok clone.** Social is in service of trip planning, not in service of attention.
- **Not Anthropic / OpenAI's API arbitrage.** We pick the model that fits the task; we don't market "AI" as the product.
- **No NFTs, no crypto, no metaverse jargon.** Aether is concrete tech (R3F, WebGPU, mediapipe, Tone.js) used in service of one product, not buzzwords pasted onto a roadmap.
- **No "we'll add testing later."** Every surface has a Playwright integration spec + Storybook visual baseline before merge.
- **No "AI-generated everything."** Procedural palette ≠ generative-AI images. The tonal layer is curated by a composer. The variable font is commissioned. AI is one channel among five.

## What this means for users

A user who lands on the v2 home screen sees: a 3D scene where their next trip floats in the foreground, ambient music in the destination's key plays softly, the AI Pulse breathes in the corner. They tap a place orb; the orb expands into a full-screen scene of that place; the audio key signature shifts; the surface re-tints in the place's dominant color. They say "find me a better lunch spot nearby"; the UI dissolves into particles, the AI processes, and a new Atlas materialises with three lunch alternatives ranked by their persona-embedding. They book the top option in two taps; the price-glyph weight visually drops; the booking confirmation arrives in their watch.

That's one minute of use. Nothing about that flow exists today.

## See also

- [`01-architecture.md`](01-architecture.md) — how it's built.
- [`02-surfaces.md`](02-surfaces.md) — the ten pillars.
- [`05-uncopyability.md`](05-uncopyability.md) — why this is a real moat.
