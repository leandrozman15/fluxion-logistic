import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { buildListMeta, ListOptions } from '../utils/listQuery.js';

export type CreateProductInput = {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  stockQuantity?: number;
  status?: 'active' | 'inactive' | 'suspended';
  photoUrl?: string;
  variants?: unknown;
  warehouses?: unknown;
};

export type UpdateProductInput = Partial<CreateProductInput>;

export async function listProducts(tenantId: string, options: ListOptions) {
  const where: Prisma.ProductWhereInput = {
    tenantId,
    ...(options.status ? { status: options.status as 'active' | 'inactive' | 'suspended' } : {}),
    ...(options.search
      ? {
          OR: [
            { sku: { contains: options.search, mode: 'insensitive' } },
            { name: { contains: options.search, mode: 'insensitive' } },
            { brand: { contains: options.search, mode: 'insensitive' } },
            { model: { contains: options.search, mode: 'insensitive' } },
            { category: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data,
    ...buildListMeta(total, options.page, options.pageSize),
  };
}

export async function createProduct(payload: CreateProductInput) {
  return prisma.product.create({
    data: {
      tenantId: payload.tenantId,
      sku: payload.sku,
      name: payload.name,
      description: payload.description,
      category: payload.category,
      stockQuantity: payload.stockQuantity,
      status: payload.status,
      photoUrl: payload.photoUrl,
      variants: payload.variants as Prisma.InputJsonValue | undefined,
      warehouses: payload.warehouses as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function updateProduct(tenantId: string, id: string, payload: UpdateProductInput) {
  const result = await prisma.product.updateMany({
    where: { id, tenantId },
    data: {
      sku: payload.sku,
      name: payload.name,
      description: payload.description,
      category: payload.category,
      stockQuantity: payload.stockQuantity,
      status: payload.status,
      photoUrl: payload.photoUrl,
      variants: payload.variants as Prisma.InputJsonValue | undefined,
      warehouses: payload.warehouses as Prisma.InputJsonValue | undefined,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.product.findFirst({ where: { id, tenantId } });
}

export async function deleteProduct(tenantId: string, id: string) {
  const result = await prisma.product.deleteMany({
    where: { id, tenantId },
  });

  return result.count > 0;
}
