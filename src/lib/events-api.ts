import { backendRequest } from '@/lib/backend-api';

export type EventPayload = {
  id?: string;
  type: string;
  prospectId?: string;
  companyName?: string;
  actorUid?: string;
  metadata?: Record<string, any>;
  createdAt?: any;
};

function normalizeEvent(raw: any): EventPayload {
  return {
    id: raw.id,
    type: raw.type || 'event',
    prospectId: raw.prospectId,
    companyName: raw.companyName,
    actorUid: raw.actorUid,
    metadata: raw.metadata || {},
    createdAt: raw.createdAt,
  };
}

export async function listEventsByProspect(prospectId: string) {
  const paths = [
    `/api/events?prospectId=${encodeURIComponent(prospectId)}&page=1&pageSize=200`,
    `/api/prospects/${encodeURIComponent(prospectId)}/events?page=1&pageSize=200`,
  ];

  for (const path of paths) {
    try {
      const response = await backendRequest<any[]>(path);
      const rows = Array.isArray(response.data) ? response.data : Array.isArray(response.payload) ? response.payload : [];
      return rows.map(normalizeEvent);
    } catch {
      // Try next known endpoint shape.
    }
  }

  return [] as EventPayload[];
}

export async function createEvent(payload: EventPayload) {
  const paths = ['/api/events', '/api/outbox/events'];

  for (const path of paths) {
    try {
      const response = await backendRequest<any>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const raw = response.data || response.payload;
      if (raw) return normalizeEvent(raw);
      return null;
    } catch {
      // Try next known endpoint shape.
    }
  }

  return null;
}
