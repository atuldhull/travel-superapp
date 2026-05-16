/**
 * Stub adapter for the EmbeddingPort (POST.2C.2).
 *
 * The env-gated default: registered whenever `OLLAMA_URL` is absent.
 * Always returns `null` → "skip-index": publish/unpublish still
 * succeed, the trip is simply not embedded. This is what makes the
 * whole feature LAW 1 ($0, zero-key e2e green) — with no Ollama and
 * no new env, the full suite passes and publication keeps working.
 *
 * Installed by prompt [POST.2C.2].
 */
import { Injectable } from '@nestjs/common';
import type { EmbeddingPort } from '../application/ports/embedding.port';

@Injectable()
export class StubEmbeddingAdapter implements EmbeddingPort {
  async embed(): Promise<number[] | null> {
    return null;
  }
}
