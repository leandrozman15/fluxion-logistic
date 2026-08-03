import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateLoadInput = {
  tenantId: string;
  orderNumber: string;
  serviceType?: string;
  clientName: string;
  clientId?: string;
  assignedDriverId?: string;
  assignedTruckId?: string;
  pickupDate: string;
  pickupTime: string;
  estimatedArrivalDate: string;
  estimatedArrivalTime: string;
  origin: Record<string, unknown>;
  outboundStops: unknown;
  totalAmount?: number;
  basePrice?: number;
  status?: 'pending' | 'assigned' | 'on_route' | 'on_pause' | 'delivered' | 'incident' | 'cancelled' | 'archived';
};

export type UpdateLoadInput = Partial<CreateLoadInput>;

export async function listLoads(tenantId: string, options: ListOptions) {
  const where: Prisma.LoadWhereInput = {
    tenantId,
    ...(options.status ? { status: options.status as 'pending' | 'assigned' | 'on_route' | 'on_pause' | 'delivered' | 'incident' | 'cancelled' | 'archived' } : {}),
    ...(options.search
      ? {
          OR: [
            { orderNumber: { contains: options.search, mode: 'insensitive' } },
            { clientName: { contains: options.search, mode: 'insensitive' } },
            { serviceType: { contains: options.search, mode: 'insensitive' } },
            { invoiceNumber: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.load.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.load.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createLoad(payload: CreateLoadInput) {
  return prisma.load.create({
    data: {
      tenantId: payload.tenantId,
      orderNumber: payload.orderNumber,
      serviceType: payload.serviceType,
      clientName: payload.clientName,
      clientId: payload.clientId,
      assignedDriverId: payload.assignedDriverId,
      assignedTruckId: payload.assignedTruckId,
      pickupDate: payload.pickupDate,
      pickupTime: payload.pickupTime,
      estimatedArrivalDate: payload.estimatedArrivalDate,
      estimatedArrivalTime: payload.estimatedArrivalTime,
      origin: payload.origin as Prisma.InputJsonValue,
      outboundStops: payload.outboundStops as Prisma.InputJsonValue,
      totalAmount: payload.totalAmount,
      basePrice: payload.basePrice,
      status: payload.status,
    },
  });
}

export async function updateLoad(tenantId: string, id: string, payload: UpdateLoadInput) {
  const result = await prisma.load.updateMany({
    where: { id, tenantId },
    data: {
      orderNumber: payload.orderNumber,
      serviceType: payload.serviceType,
      clientName: payload.clientName,
      clientId: payload.clientId,
      assignedDriverId: payload.assignedDriverId,
      assignedTruckId: payload.assignedTruckId,
      pickupDate: payload.pickupDate,
      pickupTime: payload.pickupTime,
      estimatedArrivalDate: payload.estimatedArrivalDate,
      estimatedArrivalTime: payload.estimatedArrivalTime,
      origin: payload.origin as Prisma.InputJsonValue | undefined,
      outboundStops: payload.outboundStops as Prisma.InputJsonValue | undefined,
      totalAmount: payload.totalAmount,
      basePrice: payload.basePrice,
      status: payload.status,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.load.findFirst({ where: { id, tenantId } });
}

export async function deleteLoad(tenantId: string, id: string) {
  const result = await prisma.load.deleteMany({
    where: { id, tenantId },
  });

  return result.count > 0;
}
