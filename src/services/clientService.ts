import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateClientInput = {
  tenantId: string;
  internalCode?: string;
  name: string;
  cuit: string;
  address: Record<string, unknown>;
  mainContact: Record<string, unknown>;
  industry?: string;
  facadePhotoUrl?: string;
  status?: 'active' | 'inactive';
  creditLimit?: number;
  defaultPaymentMethod?: string;
};

export type UpdateClientInput = Partial<CreateClientInput>;

export async function listClients(tenantId: string, options: ListOptions) {
  const where: Prisma.ClientWhereInput = {
    tenantId,
    ...(options.status ? { status: options.status as 'active' | 'inactive' } : {}),
    ...(options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { cuit: { contains: options.search, mode: 'insensitive' } },
            { internalCode: { contains: options.search, mode: 'insensitive' } },
            { industry: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.client.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createClient(payload: CreateClientInput) {
  return prisma.client.create({
    data: {
      tenantId: payload.tenantId,
      internalCode: payload.internalCode,
      name: payload.name,
      cuit: payload.cuit,
      address: payload.address as Prisma.InputJsonValue,
      mainContact: payload.mainContact as Prisma.InputJsonValue,
      industry: payload.industry,
      facadePhotoUrl: payload.facadePhotoUrl,
      status: payload.status,
      creditLimit: payload.creditLimit,
      defaultPaymentMethod: payload.defaultPaymentMethod,
    },
  });
}

export async function updateClient(tenantId: string, id: string, payload: UpdateClientInput) {
  const result = await prisma.client.updateMany({
    where: { id, tenantId },
    data: {
      internalCode: payload.internalCode,
      name: payload.name,
      cuit: payload.cuit,
      address: payload.address as Prisma.InputJsonValue | undefined,
      mainContact: payload.mainContact as Prisma.InputJsonValue | undefined,
      industry: payload.industry,
      facadePhotoUrl: payload.facadePhotoUrl,
      status: payload.status,
      creditLimit: payload.creditLimit,
      defaultPaymentMethod: payload.defaultPaymentMethod,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.client.findFirst({ where: { id, tenantId } });
}

export async function deleteClient(tenantId: string, id: string) {
  const result = await prisma.client.deleteMany({
    where: { id, tenantId },
  });

  return result.count > 0;
}
