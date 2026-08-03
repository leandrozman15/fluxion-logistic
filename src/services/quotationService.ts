import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateQuotationItemInput = {
  productId?: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent?: number;
  ivaRate?: number;
  subtotal: number;
  total: number;
  photoUrl?: string;
  warehouseId?: string;
};

export type CreateQuotationInput = {
  tenantId: string;
  number: string;
  date: string;
  expiryDate: string;
  clientId: string;
  clientName: string;
  clientCuit: string;
  ivaCondition: string;
  currency?: string;
  exchangeRate?: number;
  subtotal?: number;
  totalAmount?: number;
  status?: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'ordered';
  items: CreateQuotationItemInput[];
};

export type UpdateQuotationInput = Partial<CreateQuotationInput>;

export async function listQuotations(tenantId: string, options: ListOptions) {
  const where: Prisma.QuotationWhereInput = {
    tenantId,
    ...(options.status ? { status: options.status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'ordered' } : {}),
    ...(options.search
      ? {
          OR: [
            { number: { contains: options.search, mode: 'insensitive' } },
            { clientName: { contains: options.search, mode: 'insensitive' } },
            { clientCuit: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createQuotation(payload: CreateQuotationInput) {
  return prisma.quotation.create({
    data: {
      tenantId: payload.tenantId,
      number: payload.number,
      date: payload.date,
      expiryDate: payload.expiryDate,
      clientId: payload.clientId,
      clientName: payload.clientName,
      clientCuit: payload.clientCuit,
      ivaCondition: payload.ivaCondition,
      currency: payload.currency,
      exchangeRate: payload.exchangeRate,
      subtotal: payload.subtotal,
      totalAmount: payload.totalAmount,
      status: payload.status,
      items: {
        create: payload.items,
      },
    },
    include: { items: true },
  });
}

export async function updateQuotation(tenantId: string, id: string, payload: UpdateQuotationInput) {
  const result = await prisma.quotation.updateMany({
    where: { id, tenantId },
    data: {
      number: payload.number,
      date: payload.date,
      expiryDate: payload.expiryDate,
      clientId: payload.clientId,
      clientName: payload.clientName,
      clientCuit: payload.clientCuit,
      ivaCondition: payload.ivaCondition,
      currency: payload.currency,
      exchangeRate: payload.exchangeRate,
      subtotal: payload.subtotal,
      totalAmount: payload.totalAmount,
      status: payload.status,
    },
  });

  if (result.count === 0) {
    return null;
  }

  if (payload.items) {
    await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    if (payload.items.length > 0) {
      await prisma.quotationItem.createMany({
        data: payload.items.map((item) => ({
          quotationId: id,
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          ivaRate: item.ivaRate,
          subtotal: item.subtotal,
          total: item.total,
          photoUrl: item.photoUrl,
          warehouseId: item.warehouseId,
        })),
      });
    }
  }

  return prisma.quotation.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
}

export async function deleteQuotation(tenantId: string, id: string) {
  const result = await prisma.quotation.deleteMany({
    where: { id, tenantId },
  });

  return result.count > 0;
}
