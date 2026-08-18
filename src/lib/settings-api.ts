import { backendRequest } from '@/lib/backend-api';
import { withCache, invalidateCache } from '@/lib/utils/request-cache';

const TENANT_PROFILE_CACHE_KEY = 'tenant:profile';
// El perfil del tenant (nombre, plan, módulos habilitados) se pide en el layout del dashboard
// y en más de una decena de pantallas individuales; casi nunca cambia durante la sesión, así
// que un TTL algo más largo que las listas de flota/choferes es seguro.
const TENANT_PROFILE_TTL_MS = 60_000;

type TenantProfile = {
  id: string;
  name: string;
  plan?: string;
  settings?: {
    dailyEmailLimit?: number;
    hourlyEmailLimit?: number;
    [key: string]: any;
  };
};

type DailyStat = {
  id?: string;
  emailsSent?: number;
  quotaUsed?: number;
  date?: string;
  createdAt?: any;
};

function normalizeTenant(raw: any): TenantProfile {
  return {
    id: raw.id,
    name: raw.name || '',
    plan: raw.plan,
    settings: raw.settings || {},
  };
}

function normalizeDailyStat(raw: any): DailyStat {
  return {
    id: raw.id,
    emailsSent: Number(raw.emailsSent || 0),
    quotaUsed: Number(raw.quotaUsed || 0),
    date: raw.date,
    createdAt: raw.createdAt,
  };
}

const TENANT_PATHS = ['/api/tenants/me', '/api/tenant', '/api/settings/tenant'];
const DAILY_STATS_PATHS = ['/api/daily-stats', '/api/stats/daily', '/api/tenant/daily-stats'];

export async function getTenantProfile() {
  return withCache(TENANT_PROFILE_CACHE_KEY, TENANT_PROFILE_TTL_MS, async () => {
    for (const path of TENANT_PATHS) {
      try {
        const response = await backendRequest<any>(path);
        const raw = response.data || response.payload;
        if (raw) return normalizeTenant(raw);
      } catch {
        // Try next known endpoint shape.
      }
    }
    throw new Error('No tenant settings endpoint available');
  });
}

export async function updateTenantProfile(data: Partial<TenantProfile>) {
  for (const path of TENANT_PATHS) {
    try {
      const response = await backendRequest<any>(path, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      const raw = response.data || response.payload;
      if (raw) {
        invalidateCache(TENANT_PROFILE_CACHE_KEY);
        return normalizeTenant(raw);
      }
    } catch {
      // Try next known endpoint shape.
    }
  }
  throw new Error('No tenant update endpoint available');
}

export async function listDailyStats(limit = 31) {
  for (const basePath of DAILY_STATS_PATHS) {
    try {
      const response = await backendRequest<any[]>(`${basePath}?limit=${limit}`);
      const rows = Array.isArray(response.data) ? response.data : Array.isArray(response.payload) ? response.payload : [];
      return rows.map(normalizeDailyStat);
    } catch {
      // Try next known endpoint shape.
    }
  }
  return [] as DailyStat[];
}
