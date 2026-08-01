
'use client';
import { Firestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Servicio de Auditoría de LogísticaAr
 * Registra acciones del sistema para trazabilidad total.
 */
export async function logSystemEvent(
  db: Firestore | null, 
  tenantId: string, 
  user: { uid: string, email: string | null } | null, 
  action: 'create' | 'update' | 'delete' | 'auth_success' | 'document_upload', 
  targetType: 'truck' | 'driver' | 'client' | 'product' | 'load' | 'remito' | 'settings', 
  targetId: string, 
  details?: any
) {
  if (!db || !tenantId || !user) return;

  try {
    await addDoc(collection(db, "tenants", tenantId, "events"), {
      type: "system_audit",
      action,
      targetType,
      targetId,
      actorUid: user.uid,
      actorEmail: user.email,
      details: details || {},
      // Capturamos información del dispositivo para auditoría forense
      device: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        platform: typeof window !== 'undefined' ? (window.navigator as any).platform : 'unknown',
      },
      createdAt: serverTimestamp()
    });
  } catch (e) {
    // Falla silenciosa para no interrumpir la experiencia de usuario, pero se loguea en consola
    console.error("Audit Log Failure:", e);
  }
}
