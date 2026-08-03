import { Prospect } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

export type ProspectContact = {
  phone?: string;
  whatsapp?: string;
};

export type ProspectLike = {
  id: string;
  companyName?: string;
  cnpj?: string;
  industryTags?: string[];
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
  status?: string;
  effectiveScore?: number;
  source?: string;
  aiScore?: number;
  contacts?: ProspectContact[];
};

function normalizeProspect(raw: any): ProspectLike {
  return {
    id: raw.id,
    companyName: raw.companyName || '',
    cnpj: raw.cnpj || '',
    industryTags: Array.isArray(raw.industryTags) ? raw.industryTags : [],
    address: raw.address,
    status: raw.status || 'new',
    effectiveScore: Number(raw.effectiveScore || 0),
    source: raw.source,
    aiScore: Number(raw.aiScore || 0),
    contacts: Array.isArray(raw.contacts)
      ? raw.contacts.map((contact: any) => ({
          phone: contact?.phone,
          whatsapp: contact?.whatsapp,
        }))
      : [],
  };
}

function toProspect(raw: ProspectLike): Prospect {
  return {
    ...(raw as Prospect),
    id: raw.id,
    companyName: raw.companyName || '',
    cnpj: raw.cnpj || '',
    industryTags: raw.industryTags || [],
    address: raw.address,
    status: (raw.status as any) || 'new',
    effectiveScore: Number(raw.effectiveScore || 0),
    contacts: Array.isArray(raw.contacts) ? (raw.contacts as any) : [],
    aiScore: Number(raw.aiScore || 0),
  };
}

export async function listProspects(pageSize = 500) {
  const response = await backendRequest<any[]>(`/api/prospects?page=1&pageSize=${pageSize}`);
  return getListData(response).map((row) => toProspect(normalizeProspect(row)));
}

export async function createProspect(data: Partial<Prospect>) {
  const response = await backendRequest<any>('/api/prospects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create prospect');
  }
  return toProspect(normalizeProspect(raw));
}

export async function getProspectById(id: string) {
  const response = await backendRequest<any>(`/api/prospects/${id}`);
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Prospect not found');
  }
  return toProspect(normalizeProspect(raw));
}

export async function updateProspect(id: string, data: Partial<Prospect>) {
  const response = await backendRequest<any>(`/api/prospects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update prospect');
  }
  return toProspect(normalizeProspect(raw));
}
