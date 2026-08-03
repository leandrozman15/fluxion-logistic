import { Client } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeClient(raw: any): Client {
  return {
    id: raw.id,
    internalCode: raw.internalCode || '',
    name: raw.name || '',
    cuit: raw.cuit || '',
    address: raw.address || {
      street: '',
      number: '',
      city: '',
      province: '',
      country: 'Argentina',
      zip: '',
    },
    mainContact: raw.mainContact || {
      name: '',
      email: '',
      phone: '',
    },
    industry: raw.industry || '',
    facadePhotoUrl: raw.facadePhotoUrl,
    status: raw.status || 'active',
    creditLimit: Number(raw.creditLimit || 0),
    defaultPaymentMethod: raw.defaultPaymentMethod,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function listClients() {
  const response = await backendRequest<any[]>('/api/clients?page=1&pageSize=500');
  return getListData(response).map(normalizeClient);
}

export async function deleteClient(id: string) {
  await backendRequest(`/api/clients/${id}`, { method: 'DELETE' });
}
