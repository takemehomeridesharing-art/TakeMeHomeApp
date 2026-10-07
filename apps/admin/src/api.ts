/** Tiny fetch wrapper for the Take Me Home API: base URL, bearer token, typed errors. */

export const API_URL: string = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:4000`;

/**
 * Stored image/document URLs (photos, verification documents) are API paths like `/uploads/abc.jpg`.
 * Resolve them against the API base; absolute http(s)/data/blob URLs pass through unchanged.
 */
export function assetUrl(url: string): string;
export function assetUrl(url: string | null | undefined): string | null;
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  try {
    return new URL(url, API_URL).toString();
  } catch {
    return url;
  }
}

const TOKEN_KEY = 'tmh.admin.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (private mode etc.) — the session simply won't survive a reload.
  }
}

/** An error response from the API (`{ error, message }`) or a network failure. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly error: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;

/** Registers what to do when the API answers 401 to an authenticated call (usually: log out). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type Query = Record<string, string | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', `Can't reach the API at ${API_URL}. Is it running?`);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const body = (data ?? {}) as { error?: unknown; message?: unknown };
    const error = typeof body.error === 'string' ? body.error : `HTTP_${res.status}`;
    const message = typeof body.message === 'string' ? body.message : `Request failed (${res.status})`;
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, error, message);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
