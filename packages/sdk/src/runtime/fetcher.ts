/**
 * Shared fetch wrapper used by every generated SDK call. Centralises:
 *
 *   - Base URL resolution (env or runtime config)
 *   - Bearer-token injection (memory-only, never localStorage —
 *     CLAUDE.md rule 12)
 *   - JSON content-type defaults
 *   - Domain-error parsing (extracts `code` + `traceId` from the
 *     error envelope returned by `DomainExceptionFilter`)
 *
 * Generated code calls `apiFetch<T>({ url, method, params?, data? })`
 * via orval's mutator config.
 *
 * Installed by prompt [IV.18.19.16].
 */

export interface ApiFetchConfig<TData = unknown> {
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  readonly params?: Record<string, string | number | boolean | undefined>;
  readonly data?: TData;
  readonly signal?: AbortSignal;
  readonly headers?: Record<string, string>;
}

export interface ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId: string | null;
}

/**
 * Configurable runtime — set once at app boot.
 *   import { configureSdk } from '@app/sdk';
 *   configureSdk({ baseUrl: process.env.NEXT_PUBLIC_API_URL, getAccessToken: () => store.token });
 */
interface SdkConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
}

const config: SdkConfig = {
  baseUrl: 'http://localhost:3000',
  getAccessToken: () => null,
};

export function configureSdk(next: Partial<SdkConfig>): void {
  Object.assign(config, next);
}

function buildUrl(path: string, params?: ApiFetchConfig['params']): string {
  const base = config.baseUrl.replace(/\/$/, '');
  // Generated paths are typically absolute under the api prefix
  // (e.g. /api/v1/trips/:id). Strip leading slash to avoid `//`.
  const url = new URL(`${base}/${path.replace(/^\//, '')}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiFetch<TResponse>(cfg: ApiFetchConfig): Promise<TResponse> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...cfg.headers,
  };
  if (cfg.data !== undefined) {
    headers['content-type'] = headers['content-type'] ?? 'application/json';
  }
  const token = config.getAccessToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method: cfg.method,
    headers,
  };
  if (cfg.signal) init.signal = cfg.signal;
  if (cfg.data !== undefined) {
    init.body = typeof cfg.data === 'string' ? cfg.data : JSON.stringify(cfg.data);
  }

  const res = await fetch(buildUrl(cfg.url, cfg.params), init);

  if (res.status === 204) {
    // No-content responses return undefined cast to TResponse; consumers
    // expect a void-shaped return for these endpoints.
    return undefined as TResponse;
  }

  const ct = res.headers.get('content-type') ?? '';
  const isJson = ct.includes('application/json');
  const body = isJson ? ((await res.json()) as unknown) : await res.text();

  if (!res.ok) {
    const envelope = (isJson ? body : { code: 'INTERNAL_ERROR', message: String(body) }) as {
      code?: string;
      message?: string;
      traceId?: string;
    };
    const err = new Error(envelope.message ?? `HTTP ${res.status}`) as ApiError & {
      code: string;
      status: number;
      traceId: string | null;
    };
    err.code = envelope.code ?? `HTTP_${res.status}`;
    err.status = res.status;
    err.traceId = envelope.traceId ?? null;
    throw err;
  }

  return body as TResponse;
}
