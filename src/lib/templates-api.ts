import { backendRequest, getListData } from '@/lib/backend-api';

export type EmailTemplatePayload = {
  id: string;
  name: string;
  subject: string;
  body: string;
  variablesUsed?: string[];
  createdAt?: any;
  updatedAt?: any;
};

function normalizeTemplate(raw: any): EmailTemplatePayload {
  return {
    id: raw.id,
    name: raw.name || '',
    subject: raw.subject || '',
    body: raw.body || '',
    variablesUsed: Array.isArray(raw.variablesUsed) ? raw.variablesUsed : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function listTemplates() {
  const response = await backendRequest<any[]>('/api/templates?page=1&pageSize=500');
  return getListData(response).map(normalizeTemplate);
}

export async function getTemplate(id: string) {
  const response = await backendRequest<any>(`/api/templates/${id}`);
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Template not found');
  }
  return normalizeTemplate(raw);
}

export async function createTemplate(data: Partial<EmailTemplatePayload>) {
  const response = await backendRequest<any>('/api/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create template');
  }
  return normalizeTemplate(raw);
}

export async function updateTemplate(id: string, data: Partial<EmailTemplatePayload>) {
  const response = await backendRequest<any>(`/api/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update template');
  }
  return normalizeTemplate(raw);
}

export async function deleteTemplate(id: string) {
  await backendRequest(`/api/templates/${id}`, { method: 'DELETE' });
}
