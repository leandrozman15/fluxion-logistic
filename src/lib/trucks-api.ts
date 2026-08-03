import { Truck } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeTruck(raw: any): Truck {
  return {
    id: raw.id,
    plate: raw.plate || '',
    brand: raw.brand || '',
    model: raw.model || '',
    year: Number(raw.year || 0),
    axles: Number(raw.axles || 0),
    grossCombinedWeightKg: Number(raw.grossCombinedWeightKg || 0),
    unladenWeightKg: Number(raw.unladenWeightKg || 0),
    capacityKg: Number(raw.capacityKg || 0),
    odometerKm: Number(raw.odometerKm || 0),
    avgConsumption: Number(raw.avgConsumption || 0),
    status: raw.status || 'available',
    hasActiveAlert: Boolean(raw.hasActiveAlert),
    alertType: raw.alertType,
    ownershipType: raw.ownershipType || 'company',
    haulingType: raw.haulingType || 'standard',
    location: raw.location,
    assignedDriverId: raw.assignedDriverId,
    assignedCompanionIds: raw.assignedCompanionIds || [],
    avatarUrl: raw.avatarUrl,
    documentation: raw.documentation || [],
    semiTrailer: raw.semiTrailer,
    bitren: raw.bitren,
    costs: raw.costs,
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
  };
}

export async function listTrucks() {
  const response = await backendRequest<any[]>('/api/trucks?page=1&pageSize=500');
  return getListData(response).map(normalizeTruck);
}

export async function getTruck(id: string) {
  const response = await backendRequest<any>(`/api/trucks/${id}`);
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Truck not found');
  }
  return normalizeTruck(raw);
}

export async function createTruck(data: Partial<Truck>) {
  const response = await backendRequest<any>('/api/trucks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create truck');
  }
  return normalizeTruck(raw);
}

export async function updateTruck(id: string, data: Partial<Truck>) {
  const response = await backendRequest<any>(`/api/trucks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update truck');
  }
  return normalizeTruck(raw);
}

export async function deleteTruck(id: string) {
  await backendRequest(`/api/trucks/${id}`, { method: 'DELETE' });
}
