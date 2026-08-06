import { updateLoad } from '@/lib/loads-api';
import { updateTruck } from '@/lib/trucks-api';
import { createExpense } from '@/lib/expenses-api';
import { uploadBase64 } from '@/lib/storage-service';
import { compressImage } from '@/lib/utils/image-compression';

/**
 * Cola de sincronización offline para la Terminal Móvil del chofer.
 * Cuando una escritura al backend falla por falta de conexión, se guarda acá
 * (IndexedDB, soporta payloads grandes como fotos/firmas en base64) y se reintenta
 * automáticamente al recuperar señal, sin que el chofer tenga que hacer nada.
 */

export type OfflineAction =
  | {
      id: string;
      type: 'confirm_delivery';
      createdAt: string;
      description: string;
      payload: {
        loadId: string;
        activeStopsField: 'outboundStops' | 'returnStops';
        updatedStops: any[];
        stopId: string;
        nextStatus?: string;
        assignedTruckId?: string;
        receiverName: string;
        notes: string;
        receiverSignatureDataUrl: string;
        driverSignatureDataUrl: string;
        photoDataUrl: string;
        storagePrefix: string;
        occurredAt: string;
      };
    }
  | {
      id: string;
      type: 'report_failure';
      createdAt: string;
      description: string;
      payload: {
        loadId: string;
        activeStopsField: 'outboundStops' | 'returnStops';
        updatedStops: any[];
        nextStatus?: string;
        assignedTruckId?: string;
        occurredAt: string;
      };
    }
  | {
      id: string;
      type: 'emergency';
      createdAt: string;
      description: string;
      payload: {
        loadId: string;
        assignedTruckId: string;
        emergencyType: string;
        alerts: any[];
        occurredAt: string;
      };
    }
  | {
      id: string;
      type: 'expense';
      createdAt: string;
      description: string;
      payload: Record<string, any>;
    }
  | {
      id: string;
      type: 'start_trip';
      createdAt: string;
      description: string;
      payload: {
        loadId: string;
        assignedTruckId?: string;
        tracking: any;
        truckLocationPatch?: any;
        occurredAt: string;
      };
    }
  | {
      id: string;
      type: 'start_return';
      createdAt: string;
      description: string;
      payload: { loadId: string; tracking: any; occurredAt: string };
    }
  | {
      id: string;
      type: 'confirm_return_arrival';
      createdAt: string;
      description: string;
      payload: { loadId: string; tracking: any; assignedTruckId?: string; occurredAt: string };
    }
  | {
      id: string;
      type: 'gps_ping';
      createdAt: string;
      description: string;
      payload: { loadId: string; assignedTruckId?: string; tracking: any; truckLocationPatch?: any; occurredAt: string };
    };

export const OFFLINE_QUEUE_EVENT = 'fluxion-offline-queue-changed';

const DB_NAME = 'fluxion-offline-queue';
const STORE_NAME = 'actions';
const DB_VERSION = 1;

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Heurística de "es un problema de conectividad, no un error real de la app":
 * si el navegador ya sabe que está offline, o el mensaje/código del error matchea
 * los formatos típicos de fetch/Firebase Storage al no haber red.
 */
export function isLikelyOfflineError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const err = e as any;
  const code = err?.code ? String(err.code) : '';
  const message = err?.message ? String(err.message) : String(e ?? '');
  const haystack = `${code} ${message}`.toLowerCase();
  return /failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|err_network|retry-limit-exceeded|max retry time|timeout/.test(
    haystack
  );
}

/** Encola una acción para reintentar más tarde. No lanza si falla (ya estamos en modo degradado). */
export async function enqueueOfflineAction(action: Omit<OfflineAction, 'id' | 'createdAt'> & { id?: string }): Promise<void> {
  try {
    const db = await openQueueDB();
    const full = { ...action, id: action.id || generateId(), createdAt: new Date().toISOString() } as OfflineAction;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(full);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    notifyQueueChanged();
  } catch (e) {
    console.error('No se pudo encolar la acción offline:', e);
  }
}

async function getAllPending(): Promise<OfflineAction[]> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const rows = (req.result || []) as OfflineAction[];
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

async function removeAction(id: string): Promise<void> {
  const db = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyQueueChanged();
}

export async function getPendingOfflineCount(): Promise<number> {
  try {
    const rows = await getAllPending();
    return rows.length;
  } catch {
    return 0;
  }
}

async function replayAction(action: OfflineAction): Promise<void> {
  switch (action.type) {
    case 'confirm_delivery': {
      const p = action.payload;
      let receiverSignatureUrl = p.receiverSignatureDataUrl;
      if (receiverSignatureUrl.startsWith('data:image')) {
        receiverSignatureUrl = await uploadBase64(`${p.storagePrefix}/receiver_sig.png`, receiverSignatureUrl);
      }
      let driverSignatureUrl = p.driverSignatureDataUrl;
      if (driverSignatureUrl.startsWith('data:image')) {
        driverSignatureUrl = await uploadBase64(`${p.storagePrefix}/driver_sig.png`, driverSignatureUrl);
      }
      let photoUrl = p.photoDataUrl;
      if (photoUrl.startsWith('data:image')) {
        const compressed = await compressImage(photoUrl, 1024, 768, 0.6);
        photoUrl = await uploadBase64(`${p.storagePrefix}/delivery_photo.jpg`, compressed);
      }
      const updatedStops = p.updatedStops.map((s: any) =>
        s.id === p.stopId
          ? { ...s, proofOfDelivery: { ...s.proofOfDelivery, receiverSignatureUrl, driverSignatureUrl, photoUrl } }
          : s
      );
      await updateLoad(p.loadId, {
        [p.activeStopsField]: updatedStops,
        ...(p.nextStatus ? { status: p.nextStatus } : {}),
        updatedAt: p.occurredAt,
      } as any);
      if (p.nextStatus === 'delivered' && p.assignedTruckId) {
        await updateTruck(p.assignedTruckId, { status: 'available', updatedAt: p.occurredAt });
      }
      break;
    }
    case 'report_failure': {
      const p = action.payload;
      await updateLoad(p.loadId, {
        [p.activeStopsField]: p.updatedStops,
        ...(p.nextStatus ? { status: p.nextStatus } : {}),
        updatedAt: p.occurredAt,
      } as any);
      if (p.nextStatus === 'delivered' && p.assignedTruckId) {
        await updateTruck(p.assignedTruckId, { status: 'available', updatedAt: p.occurredAt });
      }
      break;
    }
    case 'emergency': {
      const p = action.payload;
      await Promise.all([
        updateTruck(p.assignedTruckId, {
          hasActiveAlert: true,
          alertType: p.emergencyType as any,
          updatedAt: p.occurredAt,
        }),
        updateLoad(p.loadId, {
          status: 'incident',
          tracking: { alerts: p.alerts } as any,
          updatedAt: p.occurredAt,
        } as any),
      ]);
      break;
    }
    case 'expense': {
      await createExpense(action.payload);
      break;
    }
    case 'start_trip': {
      const p = action.payload;
      await updateLoad(p.loadId, { status: 'on_route', tracking: p.tracking, updatedAt: p.occurredAt } as any);
      if (p.assignedTruckId && p.truckLocationPatch) {
        await updateTruck(p.assignedTruckId, { status: 'in_trip', location: p.truckLocationPatch, updatedAt: p.occurredAt });
      }
      break;
    }
    case 'start_return': {
      const p = action.payload;
      await updateLoad(p.loadId, { tracking: p.tracking, updatedAt: p.occurredAt } as any);
      break;
    }
    case 'confirm_return_arrival': {
      const p = action.payload;
      await updateLoad(p.loadId, { status: 'delivered', tracking: p.tracking, updatedAt: p.occurredAt } as any);
      if (p.assignedTruckId) {
        await updateTruck(p.assignedTruckId, { status: 'available', updatedAt: p.occurredAt });
      }
      break;
    }
    case 'gps_ping': {
      const p = action.payload;
      await updateLoad(p.loadId, { tracking: p.tracking, updatedAt: p.occurredAt } as any);
      if (p.assignedTruckId && p.truckLocationPatch) {
        await updateTruck(p.assignedTruckId, { location: p.truckLocationPatch, updatedAt: p.occurredAt });
      }
      break;
    }
  }
}

let isFlushing = false;

/** Reintenta todas las acciones pendientes en orden. Se detiene en el primer fallo (probablemente seguimos sin red). */
export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (isFlushing) return { synced: 0, remaining: await getPendingOfflineCount() };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, remaining: await getPendingOfflineCount() };
  }

  isFlushing = true;
  let synced = 0;
  try {
    const pending = await getAllPending();
    for (const action of pending) {
      try {
        await replayAction(action);
        await removeAction(action.id);
        synced += 1;
      } catch (e) {
        console.error('No se pudo sincronizar una acción pendiente, se reintentará más tarde:', action.type, e);
        break;
      }
    }
  } finally {
    isFlushing = false;
  }
  return { synced, remaining: await getPendingOfflineCount() };
}
