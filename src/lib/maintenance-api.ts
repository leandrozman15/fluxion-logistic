import { Maintenance } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeMaintenance(raw: any): Maintenance {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber || '',
    truckId: raw.truckId || '',
    type: raw.type || 'preventive',
    status: raw.status || 'scheduled',
    description: raw.description || '',
    scheduledDate: raw.scheduledDate || '',
    completedDate: raw.completedDate,
    odometerAtMaintenance: raw.odometerAtMaintenance,
    estimatedCost: Number(raw.estimatedCost || 0),
    actualCost: raw.actualCost,
    workshopName: raw.workshopName || '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  } as Maintenance;
}

export async function listMaintenance() {
  const response = await backendRequest<any[]>('/api/maintenance?page=1&pageSize=1000');
  return getListData(response).map(normalizeMaintenance);
}

export async function getMaintenance(id: string) {
  const response = await backendRequest<any>(`/api/maintenance/${id}`);
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Maintenance record not found');
  }
  return normalizeMaintenance(raw);
}

export async function createMaintenance(data: Partial<Maintenance>) {
  const response = await backendRequest<any>('/api/maintenance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create maintenance record');
  }
  return normalizeMaintenance(raw);
}

export async function updateMaintenance(id: string, data: Partial<Maintenance>) {
  const response = await backendRequest<any>(`/api/maintenance/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update maintenance record');
  }
  return normalizeMaintenance(raw);
}

export async function deleteMaintenance(id: string) {
  await backendRequest(`/api/maintenance/${id}`, { method: 'DELETE' });
}
