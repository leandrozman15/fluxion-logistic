import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateTenantInput = {
  name: string;
  plan?: string;
  monthlyFee?: number;
  subscriptionStatus?: string;
  activationDate?: string;
  expirationDate?: string;
  settings?: unknown;
};

export type UpdateTenantInput = Partial<CreateTenantInput>;

export async function listTenants(options: ListOptions) {
  const where: Prisma.TenantWhereInput = {
    ...(options.status ? { subscriptionStatus: options.status } : {}),
    ...(options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { plan: { contains: options.search, mode: 'insensitive' } },
            { subscriptionStatus: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createTenant(payload: CreateTenantInput) {
  return prisma.tenant.create({
    data: {
      name: payload.name,
      plan: payload.plan,
      monthlyFee: payload.monthlyFee,
      subscriptionStatus: payload.subscriptionStatus,
      activationDate: payload.activationDate,
      expirationDate: payload.expirationDate,
      settings: payload.settings as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function updateTenant(id: string, payload: UpdateTenantInput) {
  const result = await prisma.tenant.updateMany({
    where: { id },
    data: {
      name: payload.name,
      plan: payload.plan,
      monthlyFee: payload.monthlyFee,
      subscriptionStatus: payload.subscriptionStatus,
      activationDate: payload.activationDate,
      expirationDate: payload.expirationDate,
      settings: payload.settings as Prisma.InputJsonValue | undefined,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.tenant.findUnique({ where: { id } });
}

export async function deleteTenant(id: string) {
  const result = await prisma.tenant.deleteMany({ where: { id } });
  return result.count > 0;
}
