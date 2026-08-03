import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateTruckInput = {
  tenantId: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number;
  capacityKg?: number;
  status?: 'available' | 'in_trip' | 'maintenance';
  ownershipType?: 'company' | 'third_party';
  photoUrl?: string;
  assignedDriverId?: string;
};

export type UpdateTruckInput = Partial<CreateTruckInput>;

export async function listTrucks(tenantId: string, options: ListOptions) {
  const where: Prisma.TruckWhereInput = {
    tenantId,
    ...(options.status ? { status: options.status as 'available' | 'in_trip' | 'maintenance' } : {}),
    ...(options.search
      ? {
          OR: [
            { plate: { contains: options.search, mode: 'insensitive' } },
            { brand: { contains: options.search, mode: 'insensitive' } },
            { model: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.truck.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.truck.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createTruck(payload: CreateTruckInput) {
  return prisma.truck.create({
    data: {
      tenantId: payload.tenantId,
      plate: payload.plate,
      brand: payload.brand,
      model: payload.model,
      year: payload.year,
      capacityKg: payload.capacityKg,
      status: payload.status,
      ownershipType: payload.ownershipType,
      avatarUrl: payload.photoUrl,
      assignedDriverId: payload.assignedDriverId,
    },
  });
}

export async function updateTruck(tenantId: string, id: string, payload: UpdateTruckInput) {
  const result = await prisma.truck.updateMany({
    where: { id, tenantId },
    data: {
      plate: payload.plate,
      brand: payload.brand,
      model: payload.model,
      year: payload.year,
      capacityKg: payload.capacityKg,
      status: payload.status,
      ownershipType: payload.ownershipType,
      avatarUrl: payload.photoUrl,
      assignedDriverId: payload.assignedDriverId,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.truck.findFirst({ where: { id, tenantId } });
}

export async function deleteTruck(tenantId: string, id: string) {
  const result = await prisma.truck.deleteMany({
    where: { id, tenantId },
  });

  return result.count > 0;
}
