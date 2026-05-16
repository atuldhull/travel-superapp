/**
 * Ollama adapter for the EmbeddingPort (POST.2C.2).
 *
 * Uses the ALREADY-RUNNING local Ollama embeddings endpoint
 * (`POST {OLLAMA_URL}/api/embeddings`, model `mxbai-embed-large` =
 * 1024 dims) via native `fetch` — no SDK, no key, no Python sidecar,
 * $0, fully local. Mirrors the OllamaTripPlannerAdapter shape
 * (trimmed base URL, AbortController timeout, @app/logger, ctor that
 * never throws so module init is safe).
 *
 * Best-effort by contract: ANY infra failure (Ollama down, model not
 * pulled, non-OK, malformed body) degrades to `null` so the publish
 * still succeeds, just unindexed. It NEVER throws — the only loud
 * failure (a wrong-length vector) is enforced downstream by
 * `assertEmbeddingDimension` before the DB write, not here.
 *
 * Construction needs `baseUrl` + `model` at module init; the
 * registration in `feed.module.ts` is conditional so missing-URL
 * environments fall through to the stub.
 *
 * Installed by prompt [POST.2C.2].
 */
import { Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import type { EmbeddingPort } from '../application/ports/embedding.port';

const REQUEST_TIMEOUT_MS = 30_000;

interface OllamaEmbeddingResponse {
  readonly embedding?: readonly number[];
  readonly error?: string;
}

@Injectable()
export class OllamaEmbeddingAdapter implements EmbeddingPort {
  private readonly logger: AppLogger = createLogger('ollama-embedding');
  private readonly endpoint: string;

  constructor(
    baseUrl: string,
    private readonly model: string,
  ) {
    // Trim trailing slashes so `${baseUrl}/api/embeddings` is well-formed.
    this.endpoint = `${baseUrl.replace(/\/+$/, '')}/api/embeddings`;
  }

  async embed(text: string): Promise<number[] | null> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
        signal: controller.signal,
      });
      const json = (await response.json()) as OllamaEmbeddingResponse;
      if (!response.ok || json.error || !Array.isArray(json.embedding)) {
        this.logger.warn(
          {
            model: this.model,
            status: response.status,
            err: json.error ?? `HTTP ${response.status}`,
          },
          'trip_embedding_ollama_http_error',
        );
        return null;
      }
      this.logger.info(
        { model: this.model, dims: json.embedding.length, latencyMs: Date.now() - startedAt },
        'trip_embedding_ollama_ok',
      );
      // Return as-is — the dimension guard lives at the DB boundary so
      // a misconfigured model surfaces loudly there, not silently here.
      return [...json.embedding];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ model: this.model, err: msg }, 'trip_embedding_ollama_failed');
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
