export function requireTenantId(value: unknown): string {
  const tenantId = typeof value === 'string' ? value.trim() : '';

  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  return tenantId;
}
