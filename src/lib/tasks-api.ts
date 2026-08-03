import { backendRequest, getListData } from '@/lib/backend-api';

type TaskLike = {
  id: string;
  state: string;
  dueAt: any;
  type: string;
  notes?: string;
  companyName?: string;
  prospectId: string;
};

function normalizeTask(raw: any): TaskLike {
  return {
    id: raw.id,
    state: raw.state || 'open',
    dueAt: raw.dueAt,
    type: raw.type || 'call',
    notes: raw.notes,
    companyName: raw.companyName,
    prospectId: raw.prospectId || '',
  };
}

export async function listTasks() {
  const response = await backendRequest<any[]>('/api/tasks?page=1&pageSize=1000');
  return getListData(response).map(normalizeTask);
}

export async function updateTask(id: string, data: Partial<TaskLike>) {
  const response = await backendRequest<any>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update task');
  }
  return normalizeTask(raw);
}
