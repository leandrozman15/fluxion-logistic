import { backendRequest, getListData } from '@/lib/backend-api';
import { AppUser, UserRole } from '@/app/lib/types';

type UserPayload = {
  id?: string;
  uid?: string;
  tenantId?: string;
  email?: string;
  displayName?: string;
  role?: UserRole;
  status?: 'active' | 'invited' | 'disabled';
  lastLogin?: any;
  createdAt?: any;
};

function normalizeUser(raw: UserPayload): AppUser {
  return {
    uid: raw.uid || raw.id || '',
    tenantId: raw.tenantId || '',
    email: raw.email || '',
    displayName: raw.displayName,
    role: raw.role || 'viewer',
    status: raw.status || 'active',
    lastLogin: raw.lastLogin,
    createdAt: raw.createdAt,
  };
}

const LIST_PATHS = [
  '/api/users?page=1&pageSize=1000',
  '/api/tenant/users',
  '/api/settings/users',
];

const CREATE_PATHS = ['/api/users', '/api/users/invite', '/api/tenant/users'];

export async function listUsers() {
  for (const path of LIST_PATHS) {
    try {
      const response = await backendRequest<UserPayload[]>(path);
      const rows = getListData(response);
      return rows.map(normalizeUser);
    } catch {
      // Try next known endpoint shape.
    }
  }

  return [] as AppUser[];
}

export async function createUser(input: {
  email: string;
  password: string;
  role: UserRole;
  tenantId?: string;
}) {
  const payload = {
    email: input.email.toLowerCase().trim(),
    password: input.password,
    role: input.role,
    tenantId: input.tenantId,
  };

  for (const path of CREATE_PATHS) {
    try {
      const response = await backendRequest<UserPayload>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const raw = response.data || response.payload;
      if (raw) return normalizeUser(raw);
    } catch {
      // Try next known endpoint shape.
    }
  }

  throw new Error('No user creation endpoint available');
}
