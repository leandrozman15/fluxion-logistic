import { Hub } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeHub(raw: any): Hub {
  return {
    id: raw.id,
    name: raw.name || '',
    address: raw.address || '',
    city: raw.city || '',
    province: raw.province || '',
    country: raw.country || 'Argentina',
    lat: Number(raw.lat || 0),
    lng: Number(raw.lng || 0),
    type: raw.type || 'hub',
    phone: raw.phone || '',
    isMainBase: Boolean(raw.isMainBase),
    loadingBays: raw.loadingBays || [],
    settings: raw.settings,
    createdAt: raw.createdAt,
  } as Hub;
}

export async function listHubs() {
  const response = await backendRequest<any[]>('/api/hubs?page=1&pageSize=500');
  return getListData(response).map(normalizeHub);
}

type HubPayload = Partial<
  Pick<Hub, 'name' | 'address' | 'city' | 'province' | 'country' | 'lat' | 'lng' | 'type' | 'phone' | 'isMainBase' | 'loadingBays' | 'settings'>
>;

function mapHubPayload(payload: HubPayload) {
  return {
    name: payload.name,
    address: payload.address,
    city: payload.city,
    province: payload.province,
    country: payload.country,
    lat: payload.lat,
    lng: payload.lng,
    type: payload.type,
    phone: payload.phone,
    isMainBase: payload.isMainBase,
    loadingBays: payload.loadingBays,
    settings: payload.settings,
  };
}

export async function createHub(payload: HubPayload) {
  const response = await backendRequest<any>('/api/hubs', {
    method: 'POST',
    body: JSON.stringify(mapHubPayload(payload)),
  });
  return normalizeHub((response.payload ?? response.data) || {});
}

export async function updateHub(id: string, payload: HubPayload) {
  const response = await backendRequest<any>(`/api/hubs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(mapHubPayload(payload)),
  });
  return normalizeHub((response.payload ?? response.data) || {});
}

export async function deleteHub(id: string) {
  await backendRequest<any>(`/api/hubs/${id}`, {
    method: 'DELETE',
  });
}
