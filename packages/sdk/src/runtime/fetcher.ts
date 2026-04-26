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
 * Signature matches orval's `httpClient: 'fetch'` mutator contract:
 *
 *   apiFetch<T>(url, init): Promise<T>
 *
 * Generated code calls it as:
 *   apiFetch<TReply>(getEndpointUrl(...), { method: 'GET', ...userOpts });
 *
 * Installed by prompt [IV.18.19.16]; signature reshape [IV.18.19.17].
 */

export interface ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId: string | null;
}

/**
 * Configurable runtime — set once at app boot.
 *   import { configureSdk } from '@app/sdk';
 *   configureSdk({
 *     baseUrl: process.env.NEXT_PUBLIC_API_URL,
 *     getAccessToken: () => store.token,
 *   });
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

function joinUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = config.baseUrl.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export async function apiFetch<TResponse>(url: string, init: RequestInit = {}): Promise<TResponse> {
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (init.body !== undefined && init.body !== null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const token = config.getAccessToken();
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const res = await fetch(joinUrl(url), { ...init, headers });

  if (res.status === 204) {
    return undefined as TResponse;
  }

  const ct = res.headers.get('content-type') ?? '';
  const isJson = ct.includes('application/json');
  const body: unknown = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const envelope = (isJson ? body : { code: 'INTERNAL_ERROR', message: String(body) }) as {
      code?: string;
      message?: string;
      traceId?: string;
    };
    const err = new Error(envelope.message ?? `HTTP ${res.status}`) as Error & {
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
