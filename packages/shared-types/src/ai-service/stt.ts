/**
 * ai-service `/v1/stt` — Whisper small-v3 speech-to-text, gRPC
 * server-streaming. The schemas describe one chunk in each direction;
 * the full call is a stream of `STTChunk` in → stream of `STTPartial`
 * out.
 *
 * Authored from `docs/services/ai-service/contract.md` §2.
 * Installed by prompt [A5].
 */
import { z } from 'zod';

export const STTChunk = z.object({
  /** PCM-encoded audio bytes (base64 in REST tunnel, raw on gRPC wire). */
  audio: z.union([z.instanceof(Uint8Array), z.string()]),
  sampleRateHz: z.number().int().positive(),
  /** True on the LAST chunk so the server can flush its decoder. */
  final: z.boolean(),
});
export type STTChunk = z.infer<typeof STTChunk>;

export const STTPartial = z.object({
  text: z.string(),
  /** Mirrors the input `final` once the decoder has flushed. */
  isFinal: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type STTPartial = z.infer<typeof STTPartial>;
