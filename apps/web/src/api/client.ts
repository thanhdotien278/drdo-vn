const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  data: T;
  meta?: unknown;
  error?: { code: string; message: string };
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<{ data: T; meta?: unknown }> {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload?.error?.message ?? 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
    );
  }

  if (!payload) {
    throw new ApiRequestError(response.status, 'Phản hồi từ máy chủ không hợp lệ.');
  }

  return { data: payload.data, meta: payload.meta };
}
