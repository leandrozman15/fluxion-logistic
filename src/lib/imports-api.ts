import { backendRequest } from '@/lib/backend-api';

export type ImportLogItem = {
  id: string;
  fileName: string;
  fileType: 'excel' | 'csv';
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  status: string;
  createdAt?: any;
};

function normalizeImportLog(raw: any): ImportLogItem {
  return {
    id: raw.id || '',
    fileName: raw.fileName || '',
    fileType: raw.fileType === 'excel' ? 'excel' : 'csv',
    totalRows: Number(raw.totalRows || 0),
    importedCount: Number(raw.importedCount || 0),
    skippedCount: Number(raw.skippedCount || 0),
    status: raw.status || 'done',
    createdAt: raw.createdAt,
  };
}

const LIST_PATHS = ['/api/imports?limit=10', '/api/import-logs?limit=10', '/api/prospects/imports?limit=10'];
const CREATE_PATHS = ['/api/imports', '/api/import-logs', '/api/prospects/imports'];

export async function listImportLogs() {
  for (const path of LIST_PATHS) {
    try {
      const response = await backendRequest<any[]>(path);
      const rows = Array.isArray(response.data) ? response.data : Array.isArray(response.payload) ? response.payload : [];
      return rows.map(normalizeImportLog);
    } catch {
      // Try next known endpoint shape.
    }
  }

  return [] as ImportLogItem[];
}

export async function createImportLog(payload: Omit<ImportLogItem, 'id' | 'createdAt'>) {
  for (const path of CREATE_PATHS) {
    try {
      const response = await backendRequest<any>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const raw = response.data || response.payload;
      if (raw) return normalizeImportLog(raw);
    } catch {
      // Try next known endpoint shape.
    }
  }

  return null;
}
