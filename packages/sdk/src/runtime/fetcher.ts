/**
 * Shared fetch wrapper used by every generated SDK call. Centralises:
 *
 *   - Base URL resolution (env or runtime config)
 *   - Bearer-token injection (memory-only, never localStorage —
 *     CLAUDE.md rule 12)
 *   - JSON content-type defaults
 *   - Domain-error parsing (extracts `code` + `traceId` from the
 *     error envelope returned by `DomainExceptionFilter`)
 *   - Cookie credentials so the httpOnly refresh cookie crosses origins
 *
 * **Return shape: orval's `{data, status, headers}` envelope.** This
 * matches the type orval generates for the `httpClient: 'fetch'`
 * mutator contract:
 *
 *   apiFetch<T>(url, init): Promise<{data: T['data'], status, headers}>
 *
 * Generated code uses `apiFetch<XxxResponseSuccess>(...)` where
 * `XxxResponseSuccess = (Response200) & {headers: Headers}` and
 * `Response200 = {data: <BodyDto>, status: 200}`. Returning the
 * envelope means React-Query consumers see `result.data.data.field`
 * instead of casting through `unknown`.
 *
 * Installed by [IV.18.19.16]; signature reshape [IV.18.19.17];
 * envelope rework [IV.18.19.35].
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

/**
 * The orval envelope shape. Generic on the body type. We accept any
 * envelope-shaped TResponse (orval emits `{data, status, headers}` as
 * the success type) and return that exact shape so generic consumers
 * get a proper structural assignment.
 */
export async function apiFetch<
  TResponse extends { data: unknown; status: number; headers: Headers },
>(url: string, init: RequestInit = {}): Promise<TResponse> {
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (init.body !== undefined && init.body !== null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const token = config.getAccessToken();
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }

  // `credentials: 'include'` so the browser sends the httpOnly refresh
  // cookie set on /api/v1/auth — required for /auth/refresh to work
  // cross-origin. The api's CORS (`security.register.ts`) sets
  // `credentials: true` on matching origins.
  const res = await fetch(joinUrl(url), { credentials: 'include', ...init, headers });

  const ct = res.headers.get('content-type') ?? '';
  const isJson = ct.includes('application/json');
  const body: unknown =
    res.status === 204 ? undefined : isJson ? await res.json() : await res.text();

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

  return {
    data: body,
    status: res.status,
    headers: res.headers,
  } as unknown as TResponse;
}
