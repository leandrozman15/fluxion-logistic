import { Expense } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeExpense(raw: any): Expense {
  return {
    id: raw.id,
    loadId: raw.loadId || '',
    truckId: raw.truckId || '',
    driverId: raw.driverId || '',
    category: raw.category || 'other',
    amount: Number(raw.amount || 0),
    currency: raw.currency || 'ARS',
    description: raw.description || '',
    location: raw.location || '',
    receiptNumber: raw.receiptNumber,
    docsPresented: raw.docsPresented,
    status: raw.status || 'registered',
    liters: raw.liters,
    pricePerLiter: raw.pricePerLiter,
    odometerKm: raw.odometerKm !== undefined && raw.odometerKm !== null ? Number(raw.odometerKm) : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  } as Expense;
}

export async function listExpenses() {
  const response = await backendRequest<any[]>('/api/expenses?page=1&pageSize=1000');
  return getListData(response).map(normalizeExpense);
}

export async function createExpense(data: Partial<Expense>) {
  const response = await backendRequest<any>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to create expense');
  }
  return normalizeExpense(raw);
}

export async function updateExpense(id: string, data: Partial<Expense>) {
  const response = await backendRequest<any>(`/api/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('Failed to update expense');
  }
  return normalizeExpense(raw);
}
