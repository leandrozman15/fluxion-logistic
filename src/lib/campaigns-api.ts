import { backendRequest, getListData } from '@/lib/backend-api';

export type CampaignPayload = {
  id: string;
  name?: string;
  templateId?: string;
  channel?: 'email' | 'whatsapp';
  status?: 'draft' | 'running' | 'paused' | 'finished';
  sentCount?: number;
  failedCount?: number;
  targetCount?: number;
  createdAt?: any;
  updatedAt?: any;
};

function normalizeCampaign(raw: any): CampaignPayload {
  return {
    id: raw.id,
    name: raw.name || '',
    templateId: raw.templateId || '',
    channel: raw.channel === 'whatsapp' ? 'whatsapp' : 'email',
    status: raw.status || 'draft',
    sentCount: Number(raw.sentCount || 0),
    failedCount: Number(raw.failedCount || 0),
    targetCount: Number(raw.targetCount || 0),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function listCampaigns() {
  const paths = ['/api/campaigns?page=1&pageSize=500', '/api/marketing/campaigns?page=1&pageSize=500'];
  for (const path of paths) {
    try {
      const response = await backendRequest<any[]>(path);
      return getListData(response).map(normalizeCampaign);
    } catch {
      // Try next known endpoint shape.
    }
  }
  return [] as CampaignPayload[];
}

export async function createCampaign(data: Partial<CampaignPayload>) {
  const paths = ['/api/campaigns', '/api/marketing/campaigns'];
  for (const path of paths) {
    try {
      const response = await backendRequest<any>(path, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const raw = response.data || response.payload;
      if (raw) return normalizeCampaign(raw);
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('No campaign creation endpoint available');
}

export async function updateCampaign(id: string, data: Partial<CampaignPayload>) {
  const paths = [`/api/campaigns/${id}`, `/api/marketing/campaigns/${id}`];
  for (const path of paths) {
    try {
      const response = await backendRequest<any>(path, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      const raw = response.data || response.payload;
      if (raw) return normalizeCampaign(raw);
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('No campaign update endpoint available');
}

export async function deleteCampaign(id: string) {
  const paths = [`/api/campaigns/${id}`, `/api/marketing/campaigns/${id}`];
  for (const path of paths) {
    try {
      await backendRequest(path, { method: 'DELETE' });
      return;
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('No campaign delete endpoint available');
}
