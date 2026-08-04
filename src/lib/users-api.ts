import { backendRequest, getListData, resolveBackendToken } from '@/lib/backend-api';
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

export async function listUsers() {
  const response = await backendRequest<UserPayload[]>('/api/users?page=1&pageSize=1000');
  return getListData(response).map(normalizeUser);
}

export async function createUser(input: {
  email: string;
  password: string;
  role: UserRole;
  tenantId?: string;
  displayName?: string;
}) {
  const cleanEmail = input.email.toLowerCase().trim();

  // Paso 1: crear la cuenta real en Firebase Auth (solo Next.js tiene Admin SDK).
  const authResponse = await fetch('/api/auth/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolveBackendToken() ? { Authorization: `Bearer ${resolveBackendToken()}` } : {}),
    },
    body: JSON.stringify({
      email: cleanEmail,
      password: input.password,
      displayName: input.displayName,
      tenantId: input.tenantId,
      role: input.role,
    }),
  });
  const authData = await authResponse.json();
  if (!authResponse.ok || !authData.success) {
    throw new Error(authData.message || 'No se pudo crear el usuario en Firebase Auth');
  }

  // Paso 2: crear la fila en Postgres vinculada al uid recién creado.
  const response = await backendRequest<UserPayload>('/api/users', {
    method: 'POST',
    body: JSON.stringify({
      uid: authData.uid,
      email: cleanEmail,
      displayName: input.displayName,
      role: input.role,
      tenantId: input.tenantId,
    }),
  });

  const raw = response.data || response.payload;
  if (!raw) {
    throw new Error('El backend no devolvió el usuario creado');
  }
  return normalizeUser(raw);
}
