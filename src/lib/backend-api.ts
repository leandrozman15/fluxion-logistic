type ApiResponse<T> = {
  success: boolean;
  payload?: T;
  data?: T;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  message?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() || 'https://fluxion-logistic-backend.onrender.com';

const API_BEARER_TOKEN = process.env.NEXT_PUBLIC_BACKEND_BEARER_TOKEN?.trim() || '';

export function ensureBackendToken() {
  if (!API_BEARER_TOKEN) {
    throw new Error('Missing NEXT_PUBLIC_BACKEND_BEARER_TOKEN');
  }
}

export async function backendRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  ensureBackendToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_BEARER_TOKEN}`,
      ...(init?.headers || {}),
    },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Request failed with status ${response.status}`);
  }

  return body;
}

export function getListData<T>(response: ApiResponse<T[]>) {
  return Array.isArray(response.data) ? response.data : [];
}
