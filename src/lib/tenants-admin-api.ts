import { Tenant } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';
import { createUser } from '@/lib/users-api';

type TenantPayload = {
  id: string;
  name?: string;
  plan?: 'free' | 'pro';
  monthlyFee?: number;
  subscriptionStatus?: 'active' | 'suspended';
  activationDate?: string;
  expirationDate?: string;
  settings?: any;
  createdAt?: any;
  updatedAt?: any;
  userCount?: number;
  usersCount?: number;
};

function normalizeTenant(raw: TenantPayload): Tenant & { userCount?: number } {
  return {
    id: raw.id,
    name: raw.name || '',
    plan: raw.plan || 'free',
    monthlyFee: Number(raw.monthlyFee || 0),
    subscriptionStatus: raw.subscriptionStatus || 'active',
    activationDate: raw.activationDate,
    expirationDate: raw.expirationDate,
    settings: raw.settings || ({} as any),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    userCount: Number(raw.userCount || raw.usersCount || 0),
  } as Tenant & { userCount?: number };
}

const TENANT_LIST_PATHS = ['/api/tenants?page=1&pageSize=500', '/api/admin/tenants?page=1&pageSize=500'];
const TENANT_CREATE_PATHS = ['/api/tenants', '/api/admin/tenants'];
const TENANT_ITEM_PATHS = (id: string) => [`/api/tenants/${id}`, `/api/admin/tenants/${id}`];

export async function listTenants() {
  for (const path of TENANT_LIST_PATHS) {
    try {
      const response = await backendRequest<any[]>(path);
      return getListData(response).map((row) => normalizeTenant(row));
    } catch {
      // Try next known endpoint shape.
    }
  }
  return [] as Array<Tenant & { userCount?: number }>;
}

export async function getTenantById(id: string) {
  for (const path of TENANT_ITEM_PATHS(id)) {
    try {
      const response = await backendRequest<any>(path);
      const raw = response.data || response.payload;
      if (raw) return normalizeTenant(raw);
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('Tenant not found');
}

export async function createTenant(data: Partial<Tenant>) {
  for (const path of TENANT_CREATE_PATHS) {
    try {
      const response = await backendRequest<any>(path, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const raw = response.data || response.payload;
      if (raw) return normalizeTenant(raw);
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('No tenant creation endpoint available');
}

export async function updateTenant(id: string, data: Partial<Tenant>) {
  for (const path of TENANT_ITEM_PATHS(id)) {
    try {
      const response = await backendRequest<any>(path, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      const raw = response.data || response.payload;
      if (raw) return normalizeTenant(raw);
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('No tenant update endpoint available');
}

export async function deleteTenantById(id: string) {
  for (const path of TENANT_ITEM_PATHS(id)) {
    try {
      await backendRequest(path, { method: 'DELETE' });
      return;
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('No tenant delete endpoint available');
}

export async function createTenantManager(params: {
  tenantId: string;
  email: string;
  password: string;
}) {
  return createUser({
    email: params.email,
    password: params.password,
    role: 'manager',
    tenantId: params.tenantId,
  });
}
