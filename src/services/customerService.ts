import { prisma } from '../lib/prisma.js';

export async function listCustomers(tenantId: string) {
  return prisma.customer.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCustomer(payload: {
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
}) {
  return prisma.customer.create({
    data: payload,
  });
}
