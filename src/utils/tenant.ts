import { Request } from 'express';

export function requireTenantId(value: unknown): string {
  const tenantId = typeof value === 'string' ? value.trim() : '';

  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  return tenantId;
}

export function requireTenantIdFromAuth(req: Request): string {
  const tenantId = req.auth?.tenantId?.trim() ?? '';

  if (!tenantId) {
    throw new Error('tenant context is required');
  }

  return tenantId;
}
