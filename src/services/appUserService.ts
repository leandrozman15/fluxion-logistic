import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateAppUserInput = {
  uid: string;
  tenantId: string;
  email: string;
  displayName?: string;
  role?:
    | 'admin'
    | 'sales_admin'
    | 'purchasing_admin'
    | 'coordinator'
    | 'manager'
    | 'warehouse'
    | 'driver'
    | 'companion'
    | 'viewer';
  status?: string;
  lastLogin?: string;
};

export type UpdateAppUserInput = Partial<CreateAppUserInput>;

export async function listAppUsers(tenantId: string, options: ListOptions) {
  const where: Prisma.AppUserWhereInput = {
    tenantId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.search
      ? {
          OR: [
            { email: { contains: options.search, mode: 'insensitive' } },
            { displayName: { contains: options.search, mode: 'insensitive' } },
            { uid: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.appUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.appUser.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createAppUser(payload: CreateAppUserInput) {
  return prisma.appUser.create({
    data: {
      uid: payload.uid,
      tenantId: payload.tenantId,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      status: payload.status,
      lastLogin: payload.lastLogin ? new Date(payload.lastLogin) : undefined,
    },
  });
}

export async function updateAppUser(tenantId: string, id: string, payload: UpdateAppUserInput) {
  const result = await prisma.appUser.updateMany({
    where: { id, tenantId },
    data: {
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      status: payload.status,
      lastLogin: payload.lastLogin ? new Date(payload.lastLogin) : undefined,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.appUser.findFirst({ where: { id, tenantId } });
}

export async function deleteAppUser(tenantId: string, id: string) {
  const result = await prisma.appUser.deleteMany({
    where: { id, tenantId },
  });

  return result.count > 0;
}
