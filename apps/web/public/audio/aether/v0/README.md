# Aether v0 audio — Phase 0 placeholders

These three WAV files are **procedurally synthesized placeholders**, not finished sound design. They exist so the Drift prototype boots with audible audio while we wait for the Phase 2 composer engagement (per `docs/aether/06-decisions.md` #2).

| File                          | Source                            | Replaced when                   |
| ----------------------------- | --------------------------------- | ------------------------------- |
| `nylon-pluck-d3.wav`          | additive sines + pluck envelope   | Phase 2 — recorded nylon-string |
| `tape-ambient-d-min.wav`      | sustained-pad sines + tape wobble | Phase 2 — composed pad          |
| `mandolin-flourish-d-min.wav` | arpeggio of plucks                | Phase 2 — recorded mandolin     |

**Regenerate:** `node scripts/aether/gen-samples.mjs`

**Brand sound (Phase 2):** nylon-string + analog tape warmth + soft mandolin confirms. Locked in `docs/aether/06-decisions.md` #3.
