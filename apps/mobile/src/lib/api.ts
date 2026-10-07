import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolves the API base URL:
 * 1. `EXPO_PUBLIC_API_URL` if set;
 * 2. web: the page's hostname on port 4000;
 * 3. native: the dev machine's host from Metro's `hostUri` (e.g. `192.168.1.5:8081` → `http://192.168.1.5:4000`);
 * 4. `http://localhost:4000`.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'web') {
    const hostname = typeof window !== 'undefined' ? window.location?.hostname : undefined;
    if (hostname) return `http://${hostname}:4000`;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return 'http://localhost:4000';
}

/** Base URL of the Take Me Home API, e.g. `http://192.168.1.5:4000`. */
export const API_URL = resolveApiUrl();

/**
 * Resolves a stored asset path (`/uploads/abc.jpg`, as returned by `POST /uploads` and stored in
 * `photoUrl`, vehicle `photos`, `documentUrl`) against the API. Absolute http(s)/data/file/blob
 * URLs pass through unchanged. Returns `undefined` for empty input so it can feed `source` props.
 */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|file:|blob:|content:|ph:|assets-library:)/i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** An API failure. `code` is the API's `error` field (e.g. `NO_SEATS`), or `NETWORK_ERROR`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** A human-readable message for any thrown value (ApiError, Error or other). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Anything with a zod-like `safeParse`, used to validate responses in development. */
export interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions<T> {
  /** Query-string parameters; `undefined`/`null` values are dropped. */
  query?: Record<string, QueryValue>;
  /** Validates the response in development (logs a warning on mismatch, never throws). */
  schema?: ResponseSchema<T>;
  /** Send the bearer token (default true when signed in). */
  auth?: boolean;
  signal?: AbortSignal;
}

let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

/** Wires the API client to the session store (called once by `stores/session.ts`). */
export function configureApiAuth(config: { getToken: () => string | null; onUnauthorized: () => void }): void {
  getToken = config.getToken;
  onUnauthorized = config.onUnauthorized;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

async function request<T>(method: string, path: string, body: unknown, options: RequestOptions<T> = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = options.auth === false ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach Take Me Home right now. Check your connection and try again.");
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = (typeof data === 'object' && data !== null ? data : {}) as { error?: string; message?: string; details?: unknown };
    const apiError = new ApiError(res.status, err.error ?? `HTTP_${res.status}`, err.message ?? `Request failed (${res.status})`, err.details);
    if (res.status === 401 && token && apiError.code === 'UNAUTHORIZED') onUnauthorized();
    throw apiError;
  }

  if (__DEV__ && options.schema) {
    const parsed = options.schema.safeParse(data);
    if (!parsed.success) console.warn(`[api] ${method} ${path}: response does not match the shared schema`, parsed.error);
  }
  return data as T;
}

/** Typed JSON client for the Take Me Home API. Throws `ApiError` on non-2xx responses. */
export const api = {
  get: <T>(path: string, options?: RequestOptions<T>) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions<T>) => request<T>('POST', path, body ?? {}, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions<T>) => request<T>('PATCH', path, body ?? {}, options),
  delete: <T>(path: string, options?: RequestOptions<T>) => request<T>('DELETE', path, undefined, options),
};
