import { Request, Response } from 'express';
import {
  DateRangeFilter,
  getExpensesByCategory,
  getLoadsByStatus,
  getOverviewMetrics,
  getQuotationsByStatus,
  getRevenueTrend,
} from '../services/analyticsService.js';
import { requireTenantIdFromAuth } from '../utils/tenant.js';

function parseMonths(value: unknown): number {
  if (typeof value !== 'string') {
    return 6;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 6;
  }

  return parsed;
}

function parseDateInput(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date format. Use ISO date in from/to query params');
  }

  return parsed;
}

function parseDateRange(query: Request['query']): DateRangeFilter {
  const from = parseDateInput(query.from);
  const to = parseDateInput(query.to);

  if (from && to && from > to) {
    throw new Error('from must be before or equal to to');
  }

  return { from, to };
}

export async function getChartsOverview(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const dateRange = parseDateRange(req.query);
    const data = await getOverviewMetrics(tenantId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    const badRequestErrors = ['tenant context is required', 'Invalid date format. Use ISO date in from/to query params', 'from must be before or equal to to'];
    const status = badRequestErrors.includes((error as Error).message) ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function getLoadsStatusChart(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const dateRange = parseDateRange(req.query);
    const data = await getLoadsByStatus(tenantId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    const badRequestErrors = ['tenant context is required', 'Invalid date format. Use ISO date in from/to query params', 'from must be before or equal to to'];
    const status = badRequestErrors.includes((error as Error).message) ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function getQuotationsStatusChart(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const dateRange = parseDateRange(req.query);
    const data = await getQuotationsByStatus(tenantId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    const badRequestErrors = ['tenant context is required', 'Invalid date format. Use ISO date in from/to query params', 'from must be before or equal to to'];
    const status = badRequestErrors.includes((error as Error).message) ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function getRevenueTrendChart(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const months = parseMonths(req.query.months);
    const dateRange = parseDateRange(req.query);
    const data = await getRevenueTrend(tenantId, months, dateRange);
    res.json({ success: true, data, months: Math.min(Math.max(months, 1), 24) });
  } catch (error) {
    const badRequestErrors = ['tenant context is required', 'Invalid date format. Use ISO date in from/to query params', 'from must be before or equal to to'];
    const status = badRequestErrors.includes((error as Error).message) ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function getExpensesCategoryChart(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const dateRange = parseDateRange(req.query);
    const data = await getExpensesByCategory(tenantId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    const badRequestErrors = ['tenant context is required', 'Invalid date format. Use ISO date in from/to query params', 'from must be before or equal to to'];
    const status = badRequestErrors.includes((error as Error).message) ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
