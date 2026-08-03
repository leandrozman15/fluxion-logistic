import { Quotation, QuotationItem, QuotationStatus } from '@/app/lib/types';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ListResult = {
  data: Quotation[];
  meta: ListMeta;
};

type ApiResponse<T> = {
  success: boolean;
  payload?: T;
  data?: T;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  message?: string;
};

type Primitive = string | number | boolean | null | undefined;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() || 'https://fluxion-logistic-backend.onrender.com';

const API_BEARER_TOKEN = process.env.NEXT_PUBLIC_BACKEND_BEARER_TOKEN?.trim() || '';

function toNumber(value: Primitive, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeQuotationItem(item: Partial<QuotationItem>): QuotationItem {
  return {
    productId: item.productId || '',
    sku: item.sku || '',
    name: item.name || '',
    quantity: toNumber(item.quantity),
    unit: item.unit || 'un',
    unitPrice: toNumber(item.unitPrice),
    discountPercent: toNumber(item.discountPercent),
    ivaRate: toNumber(item.ivaRate, 21),
    subtotal: toNumber(item.subtotal),
    total: toNumber(item.total),
    photoUrl: item.photoUrl,
    warehouseId: item.warehouseId,
  };
}

function normalizeQuotation(raw: any): Quotation {
  return {
    id: raw.id,
    number: raw.number || '',
    date: raw.date || '',
    expiryDate: raw.expiryDate || '',
    clientId: raw.clientId || '',
    clientName: raw.clientName || '',
    clientCuit: raw.clientCuit || '',
    ivaCondition: raw.ivaCondition || '',
    branchId: raw.branchId || '',
    sellerId: raw.sellerId || '',
    sellerName: raw.sellerName || '',
    priceListId: raw.priceListId || '',
    currency: raw.currency || 'ARS',
    exchangeRate: toNumber(raw.exchangeRate, 1),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeQuotationItem) : [],
    subtotal: toNumber(raw.subtotal),
    commercialDiscount: toNumber(raw.commercialDiscount),
    logisticSurcharge: toNumber(raw.logisticSurcharge),
    taxTotal: toNumber(raw.taxTotal),
    totalAmount: toNumber(raw.totalAmount),
    includeTransport: Boolean(raw.includeTransport),
    transportPaidBy: raw.transportPaidBy || 'company',
    freightValue: toNumber(raw.freightValue),
    deliveryType: raw.deliveryType || '',
    deliveryAddress: raw.deliveryAddress || '',
    paymentMethod: raw.paymentMethod || '',
    paymentTerm: raw.paymentTerm || '',
    deliveryTimeDays: toNumber(raw.deliveryTimeDays),
    warrantyInfo: raw.warrantyInfo || '',
    status: (raw.status || 'draft') as QuotationStatus,
    notes: raw.notes || '',
    internalNotes: raw.internalNotes || '',
    tenantId: raw.tenantId || '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function ensureToken() {
  if (!API_BEARER_TOKEN) {
    throw new Error('Missing NEXT_PUBLIC_BACKEND_BEARER_TOKEN');
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  ensureToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_BEARER_TOKEN}`,
      ...(init?.headers || {}),
    },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Request failed with status ${response.status}`);
  }

  return body;
}

export async function listQuotations(params?: {
  search?: string;
  status?: QuotationStatus;
  page?: number;
  pageSize?: number;
}): Promise<ListResult> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const query = searchParams.toString();
  const result = await apiRequest<any[]>(`/api/quotations${query ? `?${query}` : ''}`);
  const rows = Array.isArray(result.data) ? result.data : [];

  return {
    data: rows.map(normalizeQuotation),
    meta: {
      page: result.page || 1,
      pageSize: result.pageSize || rows.length || 1,
      total: result.total || rows.length,
      totalPages: result.totalPages || 1,
    },
  };
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
  const pageSize = 200;
  const firstPage = await listQuotations({ page: 1, pageSize });
  const inFirstPage = firstPage.data.find((q) => q.id === id);
  if (inFirstPage) return inFirstPage;

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const next = await listQuotations({ page, pageSize });
    const found = next.data.find((q) => q.id === id);
    if (found) return found;
  }

  return null;
}

export async function createQuotation(payload: Partial<Quotation>) {
  const result = await apiRequest<Quotation>('/api/quotations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeQuotation((result.payload ?? result.data) as any);
}

export async function updateQuotation(id: string, payload: Partial<Quotation>) {
  const result = await apiRequest<Quotation>(`/api/quotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return normalizeQuotation((result.payload ?? result.data) as any);
}

export async function deleteQuotation(id: string) {
  await apiRequest<{ message: string }>(`/api/quotations/${id}`, {
    method: 'DELETE',
  });
}
