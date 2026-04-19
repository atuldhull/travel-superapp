import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

const CHECK_TIMEOUT_MS = 2_000;

/**
 * Minimal HTTP reachability check using Node 22's built-in fetch. Avoids
 * pulling in @nestjs/axios + axios for a single GET.
 *
 * A 2xx or 3xx status is healthy. Anything else — or a fetch that throws —
 * is unhealthy. Caller passes a friendly `key` ("meilisearch") so the
 * terminus response is self-describing.
 */
@Injectable()
export class HttpPingIndicator extends HealthIndicator {
  async isHealthy(key: string, url: string): Promise<HealthIndicatorResult> {
    const started = Date.now();
    const controller = new AbortController();
    const abort = setTimeout(() => {
      controller.abort();
    }, CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal, method: 'GET' });
      const latencyMs = Date.now() - started;
      const ok = response.ok || (response.status >= 200 && response.status < 400);
      const result = this.getStatus(key, ok, { latencyMs, httpStatus: response.status });
      if (!ok) {
        throw new HealthCheckError(`${key} returned HTTP ${response.status}`, result);
      }
      return result;
    } catch (err) {
      const latencyMs = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      throw new HealthCheckError(
        `${key} unreachable`,
        this.getStatus(key, false, { latencyMs, error: message }),
      );
    } finally {
      clearTimeout(abort);
    }
  }
}
