import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateDriverInput = {
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
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
  status?: 'active' | 'in_trip' | 'resting' | 'suspended' | 'retired';
  licenseNumber?: string;
  nationality?: string;
  avatarUrl?: string;
};

export type UpdateDriverInput = Partial<CreateDriverInput>;

export async function listDrivers(tenantId: string, options: ListOptions) {
  const where: Prisma.DriverWhereInput = {
    tenantId,
    ...(options.status ? { status: options.status as Prisma.EnumDriverStatusFilter['equals'] } : {}),
    ...(options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { email: { contains: options.search, mode: 'insensitive' } },
            { phone: { contains: options.search, mode: 'insensitive' } },
            { licenseNumber: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.driver.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createDriver(payload: CreateDriverInput) {
  return prisma.driver.create({
    data: {
      tenantId: payload.tenantId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      status: payload.status,
      licenseNumber: payload.licenseNumber,
      nationality: payload.nationality,
      avatarUrl: payload.avatarUrl,
    },
  });
}

export async function updateDriver(tenantId: string, id: string, payload: UpdateDriverInput) {
  const result = await prisma.driver.updateMany({
    where: { id, tenantId },
    data: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      status: payload.status,
      licenseNumber: payload.licenseNumber,
      nationality: payload.nationality,
      avatarUrl: payload.avatarUrl,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.driver.findFirst({ where: { id, tenantId } });
}

export async function deleteDriver(tenantId: string, id: string) {
  const result = await prisma.driver.deleteMany({ where: { id, tenantId } });
  return result.count > 0;
}
