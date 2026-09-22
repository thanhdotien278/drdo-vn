const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const TOKEN_STORAGE_KEY = 'drdo.auth.token';

export function getAuthToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiEnvelope<T> {
  data: T;
  meta?: unknown;
  error?: { code: string; message: string };
}

interface ApiRequestOptions {
  params?: Record<string, string | number | undefined>;
  body?: unknown;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  options?: ApiRequestOptions,
): Promise<{ data: T; meta?: unknown }> {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options?.params ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const token = getAuthToken();
  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: 'application/json',
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload?.error?.message ?? 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
      payload?.error?.code,
    );
  }

  if (!payload) {
    throw new ApiRequestError(response.status, 'Phản hồi từ máy chủ không hợp lệ.');
  }

  return { data: payload.data, meta: payload.meta };
}

export function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<{ data: T; meta?: unknown }> {
  return apiRequest<T>('GET', path, { params });
}
