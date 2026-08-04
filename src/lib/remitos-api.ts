import { PendingRemito } from '@/app/lib/types';
import { resolveBackendToken } from '@/lib/backend-api';

type ApiResponse<T> = {
  success: boolean;
  payload?: T;
  data?: T;
  message?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() || 'https://fluxion-logistic-backend.onrender.com';

const REMITOS_BASE_PATHS = ['/api/remitos', '/api/pending-remitos', '/api/pending_remitos'];

async function requestWithFallback<T>(pathSuffix: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = resolveBackendToken();

  let lastError: Error | null = null;

  for (const basePath of REMITOS_BASE_PATHS) {
    const response = await fetch(`${API_BASE_URL}${basePath}${pathSuffix}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });

    let body: ApiResponse<T>;
    try {
      body = (await response.json()) as ApiResponse<T>;
    } catch {
      body = { success: response.ok, message: `Request failed with status ${response.status}` };
    }

    if (response.status === 404) {
      lastError = new Error(body.message || `Endpoint not found (${basePath})`);
      continue;
    }

    if (!response.ok || body.success === false) {
      throw new Error(body.message || `Request failed with status ${response.status}`);
    }

    return body;
  }

  throw lastError || new Error('No remitos endpoint available');
}

function normalizePendingRemito(raw: any): PendingRemito {
  return {
    id: raw.id,
    number: raw.number || '',
    cotNumber: raw.cotNumber,
    clientId: raw.clientId || '',
    clientName: raw.clientName || '',
    clientCuit: raw.clientCuit,
    address: raw.address || '',
    city: raw.city || '',
    province: raw.province || '',
    lat: Number(raw.lat || 0),
    lng: Number(raw.lng || 0),
    weightKg: Number(raw.weightKg || 0),
    volumeM3: Number(raw.volumeM3 || 0),
    notes: raw.notes,
    items: raw.items || [],
    fileUrl: raw.fileUrl,
    status: raw.status || 'pending',
    loadId: raw.loadId,
    dispatchedDate: raw.dispatchedDate,
    deliveredAt: raw.deliveredAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  } as PendingRemito;
}

export async function listRemitos() {
  const response = await requestWithFallback<any[]>('?page=1&pageSize=1000');
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map(normalizePendingRemito);
}

export async function createRemito(data: Partial<PendingRemito>) {
  const response = await requestWithFallback<any>('', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create remito');
  }
  return normalizePendingRemito(raw);
}

export async function updateRemito(id: string, data: Partial<PendingRemito>) {
  const response = await requestWithFallback<any>(`/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update remito');
  }
  return normalizePendingRemito(raw);
}

export async function deleteRemito(id: string) {
  await requestWithFallback(`/${id}`, { method: 'DELETE' });
}
