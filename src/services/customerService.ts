import { prisma } from '../lib/prisma.js';

export async function listCustomers() {
  return prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCustomer(payload: { name: string; email: string; phone?: string; address?: string; company?: string }) {
  return prisma.customer.create({
    data: payload,
  });
}
