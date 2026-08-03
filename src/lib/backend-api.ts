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

const BROWSER_PROXY_BASE = '/api/backend-proxy';

const API_BEARER_TOKEN = process.env.NEXT_PUBLIC_BACKEND_BEARER_TOKEN?.trim() || '';

function getRuntimeToken() {
  if (typeof window === 'undefined') return '';

  return (
    window.localStorage.getItem('NEXT_PUBLIC_BACKEND_BEARER_TOKEN') ||
    window.localStorage.getItem('backendBearerToken') ||
    window.sessionStorage.getItem('NEXT_PUBLIC_BACKEND_BEARER_TOKEN') ||
    window.sessionStorage.getItem('backendBearerToken') ||
    ''
  );
}

export function resolveBackendToken() {
  return API_BEARER_TOKEN || getRuntimeToken();
}

export function ensureBackendToken() {
  const token = resolveBackendToken();
  if (!token) {
    return null;
  }

  return token;
}

export async function backendRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = ensureBackendToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = typeof window === 'undefined' ? API_BASE_URL : BROWSER_PROXY_BASE;

  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    headers,
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
