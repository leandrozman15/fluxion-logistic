import { backendRequest, getListData } from '@/lib/backend-api';

export type OutboxState = 'queued' | 'sent' | 'failed';

export type OutboxMessagePayload = {
  id: string;
  companyName?: string;
  to?: string;
  type?: 'email' | 'whatsapp';
  state?: OutboxState;
  body?: string;
  subject?: string;
  campaignId?: string;
  prospectId?: string;
  attempts?: number;
  lastError?: string | null;
  sentAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

function normalizeOutboxMessage(raw: any): OutboxMessagePayload {
  return {
    id: raw.id,
    companyName: raw.companyName || '',
    to: raw.to,
    type: raw.type === 'whatsapp' ? 'whatsapp' : 'email',
    state: raw.state || 'queued',
    body: raw.body || '',
    subject: raw.subject || '',
    campaignId: raw.campaignId,
    prospectId: raw.prospectId,
    attempts: Number(raw.attempts || 0),
    lastError: raw.lastError ?? null,
    sentAt: raw.sentAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function listOutboxMessages() {
  const response = await backendRequest<any[]>('/api/outbox?page=1&pageSize=1000');
  return getListData(response).map(normalizeOutboxMessage);
}

export async function updateOutboxMessage(id: string, data: Partial<OutboxMessagePayload>) {
  const response = await backendRequest<any>(`/api/outbox/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update outbox message');
  }
  return normalizeOutboxMessage(raw);
}

export async function createOutboxMessage(data: Partial<OutboxMessagePayload>) {
  const response = await backendRequest<any>('/api/outbox', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create outbox message');
  }
  return normalizeOutboxMessage(raw);
}

export async function incrementCampaignSentCount(campaignId?: string) {
  if (!campaignId) return;

  try {
    await backendRequest(`/api/campaigns/${campaignId}/sent-count`, {
      method: 'POST',
      body: JSON.stringify({ incrementBy: 1 }),
    });
    return;
  } catch {
    // Try common fallback path below.
  }

  try {
    await backendRequest(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      body: JSON.stringify({ sentCountIncrement: 1 }),
    });
  } catch {
    // Best effort: keep message flow even if campaign counter endpoint is unavailable.
  }
}

export async function logOutboxEvent(payload: {
  type: string;
  prospectId?: string;
  companyName?: string;
  actorUid?: string;
  metadata?: Record<string, any>;
}) {
  const paths = ['/api/events', '/api/outbox/events'];

  for (const path of paths) {
    try {
      await backendRequest(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return;
    } catch {
      // Try next known endpoint shape.
    }
  }
}
