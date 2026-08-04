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

const BACKEND_TOKEN_KEY = 'backendBearerToken';

// Refresh en curso disparado por FirebaseClientProvider/AuthProvider; backendRequest lo espera
// para evitar 401 por una carrera entre el listener de Firestore (tenantId) y este intercambio.
let pendingSessionPromise: Promise<string | null> | null = null;

function getRuntimeToken() {
  if (typeof window === 'undefined') return '';

  return (
    window.localStorage.getItem('NEXT_PUBLIC_BACKEND_BEARER_TOKEN') ||
    window.localStorage.getItem(BACKEND_TOKEN_KEY) ||
    window.sessionStorage.getItem('NEXT_PUBLIC_BACKEND_BEARER_TOKEN') ||
    window.sessionStorage.getItem(BACKEND_TOKEN_KEY) ||
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

/** Intercambia el ID token de Firebase por el JWT del backend y lo guarda en sessionStorage. */
export function refreshBackendSession(idToken: string) {
  const promise = (async () => {
    try {
      const response = await fetch('/api/auth/backend-session', {
        method: 'POST',
        headers: { authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (response.ok && data.token) {
        window.sessionStorage.setItem(BACKEND_TOKEN_KEY, data.token);
        return data.token as string;
      }
      console.error('No se pudo obtener la sesión del backend:', data.message);
      window.sessionStorage.removeItem(BACKEND_TOKEN_KEY);
      return null;
    } catch (e) {
      console.error('Error al conectar con el backend:', e);
      return null;
    }
  })();

  pendingSessionPromise = promise;
  return promise;
}

export function clearBackendSession() {
  pendingSessionPromise = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(BACKEND_TOKEN_KEY);
  }
}

async function resolveBackendTokenAsync(): Promise<string> {
  const cached = resolveBackendToken();
  if (cached) return cached;
  if (pendingSessionPromise) {
    const fresh = await pendingSessionPromise;
    if (fresh) return fresh;
  }
  return '';
}

export async function backendRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = typeof window === 'undefined' ? ensureBackendToken() || '' : await resolveBackendTokenAsync();
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
