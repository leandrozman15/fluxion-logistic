import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type MonthlyPoint = {
  month: string;
  total: number;
};

export type DateRangeFilter = {
  from?: Date;
  to?: Date;
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
}

function startMonthFromNow(months: number): Date {
  const start = startOfCurrentMonthUtc();
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  return start;
}

function buildMonthSeries(months: number): string[] {
  const start = startMonthFromNow(months);
  const keys: string[] = [];

  for (let i = 0; i < months; i += 1) {
    const d = new Date(start);
    d.setUTCMonth(start.getUTCMonth() + i);
    keys.push(monthKey(d));
  }

  return keys;
}

function buildMonthSeriesFromRange(from: Date, to: Date): string[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1, 0, 0, 0));
  const keys: string[] = [];

  const current = new Date(start);
  while (current <= end && keys.length < 24) {
    keys.push(monthKey(current));
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return keys;
}

function buildCreatedAtFilter(range?: DateRangeFilter): Prisma.DateTimeFilter | undefined {
  if (!range?.from && !range?.to) {
    return undefined;
  }

  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

export async function getOverviewMetrics(tenantId: string, range?: DateRangeFilter) {
  const createdAt = buildCreatedAtFilter(range);

  const [clients, drivers, trucks, products, loads, quotations, users, deliveredLoads, activeLoads, loadRevenue, quotationRevenue] =
    await Promise.all([
      prisma.client.count({ where: { tenantId } }),
      prisma.driver.count({ where: { tenantId } }),
      prisma.truck.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.load.count({ where: { tenantId, ...(createdAt ? { createdAt } : {}) } }),
      prisma.quotation.count({ where: { tenantId, ...(createdAt ? { createdAt } : {}) } }),
      prisma.appUser.count({ where: { tenantId } }),
      prisma.load.count({ where: { tenantId, status: 'delivered', ...(createdAt ? { createdAt } : {}) } }),
      prisma.load.count({
        where: { tenantId, status: { in: ['assigned', 'on_route', 'on_pause'] }, ...(createdAt ? { createdAt } : {}) },
      }),
      prisma.load.aggregate({
        where: { tenantId, status: { not: 'cancelled' }, ...(createdAt ? { createdAt } : {}) },
        _sum: { totalAmount: true },
      }),
      prisma.quotation.aggregate({
        where: { tenantId, status: { in: ['accepted', 'ordered'] }, ...(createdAt ? { createdAt } : {}) },
        _sum: { totalAmount: true },
      }),
    ]);

  return {
    counters: {
      clients,
      drivers,
      trucks,
      products,
      loads,
      quotations,
      users,
    },
    operations: {
      deliveredLoads,
      activeLoads,
    },
    revenue: {
      loadsTotal: toNumber(loadRevenue._sum.totalAmount),
      quotationsAcceptedTotal: toNumber(quotationRevenue._sum.totalAmount),
    },
  };
}

export async function getLoadsByStatus(tenantId: string, range?: DateRangeFilter) {
  const createdAt = buildCreatedAtFilter(range);
  const rows = await prisma.load.groupBy({
    by: ['status'],
    where: { tenantId, ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
    orderBy: { status: 'asc' },
  });

  return rows.map((row) => ({
    status: row.status,
    total: row._count._all,
  }));
}

export async function getQuotationsByStatus(tenantId: string, range?: DateRangeFilter) {
  const createdAt = buildCreatedAtFilter(range);
  const rows = await prisma.quotation.groupBy({
    by: ['status'],
    where: { tenantId, ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
    orderBy: { status: 'asc' },
  });

  return rows.map((row) => ({
    status: row.status,
    total: row._count._all,
  }));
}

export async function getRevenueTrend(tenantId: string, months: number, range?: DateRangeFilter): Promise<MonthlyPoint[]> {
  const safeMonths = Math.min(Math.max(months, 1), 24);
  const from = range?.from;
  const to = range?.to;

  const monthKeys = from && to ? buildMonthSeriesFromRange(from, to) : buildMonthSeries(safeMonths);
  const createdAt =
    from || to
      ? buildCreatedAtFilter({ from, to })
      : {
          gte: startMonthFromNow(safeMonths),
        };

  const rows = await prisma.load.findMany({
    where: {
      tenantId,
      createdAt,
      status: { not: 'cancelled' },
    },
    select: {
      createdAt: true,
      totalAmount: true,
    },
  });

  const totals = new Map<string, number>();
  for (const key of monthKeys) {
    totals.set(key, 0);
  }

  for (const row of rows) {
    const key = monthKey(row.createdAt);
    if (!totals.has(key)) {
      continue;
    }

    const current = totals.get(key) ?? 0;
    totals.set(key, current + toNumber(row.totalAmount));
  }

  return monthKeys.map((key) => ({
    month: key,
    total: Number((totals.get(key) ?? 0).toFixed(2)),
  }));
}

export async function getExpensesByCategory(tenantId: string, range?: DateRangeFilter) {
  const createdAt = buildCreatedAtFilter(range);
  const rows = await prisma.expense.groupBy({
    by: ['category'],
    where: { tenantId, ...(createdAt ? { createdAt } : {}) },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { category: 'asc' },
  });

  return rows.map((row) => ({
    category: row.category,
    total: toNumber(row._sum.amount),
    count: row._count._all,
  }));
}
