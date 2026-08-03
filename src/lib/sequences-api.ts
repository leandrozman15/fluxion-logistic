import { backendRequest, getListData } from '@/lib/backend-api';

export type SequenceStepPayload = {
  dayOffset: number;
  channel: string;
  purpose: string;
  useAgent?: boolean;
};

export type SequencePayload = {
  id: string;
  name: string;
  isActive: boolean;
  steps: SequenceStepPayload[];
  rules?: Record<string, any>;
  createdAt?: any;
  updatedAt?: any;
};

function normalizeSequence(raw: any): SequencePayload {
  return {
    id: raw.id,
    name: raw.name || '',
    isActive: Boolean(raw.isActive),
    steps: Array.isArray(raw.steps)
      ? raw.steps.map((step: any) => ({
          dayOffset: Number(step?.dayOffset || 0),
          channel: step?.channel || 'task_only',
          purpose: step?.purpose || 'followup',
          useAgent: Boolean(step?.useAgent),
        }))
      : [],
    rules: raw.rules,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function listSequences() {
  const response = await backendRequest<any[]>('/api/sequences?page=1&pageSize=500');
  return getListData(response).map(normalizeSequence);
}

export async function createSequence(data: Partial<SequencePayload>) {
  const response = await backendRequest<any>('/api/sequences', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create sequence');
  }
  return normalizeSequence(raw);
}

export async function updateSequence(id: string, data: Partial<SequencePayload>) {
  const response = await backendRequest<any>(`/api/sequences/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update sequence');
  }
  return normalizeSequence(raw);
}

export async function deleteSequence(id: string) {
  await backendRequest(`/api/sequences/${id}`, { method: 'DELETE' });
}
