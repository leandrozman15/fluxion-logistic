'use client';

import { useState, useEffect, useRef } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { OFFLINE_QUEUE_EVENT, flushOfflineQueue, getPendingOfflineCount } from '@/lib/offline-queue';

/**
 * Componente que monitorea la conexión a internet y la cola de sincronización offline.
 * Crucial para que el chofer sepa cuando está en zona sin señal, y que sus acciones
 * (entregas, incidentes, gastos, SOS) se guardan igual y se sincronizan solas al volver la señal.
 */
export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showSynced, setShowSynced] = useState(false);
  const syncedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshCount = () => getPendingOfflineCount().then(setPendingCount);

    const attemptFlush = async () => {
      const before = await getPendingOfflineCount();
      const { remaining } = await flushOfflineQueue();
      setPendingCount(remaining);
      if (before > 0 && remaining === 0) {
        setShowSynced(true);
        if (syncedTimeoutRef.current) clearTimeout(syncedTimeoutRef.current);
        syncedTimeoutRef.current = setTimeout(() => setShowSynced(false), 4000);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      attemptFlush();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowSynced(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshCount);

    // Estado inicial
    setIsOnline(navigator.onLine);
    refreshCount();
    if (navigator.onLine) attemptFlush();

    // Reintento periódico: cubre el caso de que la señal vuelva sin disparar el evento 'online'.
    const intervalId = setInterval(() => {
      if (navigator.onLine) attemptFlush();
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshCount);
      clearInterval(intervalId);
      if (syncedTimeoutRef.current) clearTimeout(syncedTimeoutRef.current);
    };
  }, []);

  const isSyncing = isOnline && pendingCount > 0;

  if (isOnline && !isSyncing && !showSynced) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-500">
      {!isOnline ? (
        <Badge className="bg-orange-600 hover:bg-orange-600 text-white border-none px-4 py-2 flex items-center gap-2 shadow-2xl rounded-full">
          <WifiOff size={16} className="animate-pulse" />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-black uppercase tracking-tighter">Trabajando sin conexión</span>
            <span className="text-[8px] font-bold opacity-80">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? 'ACCIÓN' : 'ACCIONES'} SE SINCRONIZARÁN AL RECUPERAR SEÑAL`
                : 'SE SINCRONIZARÁ AL RECUPERAR SEÑAL'}
            </span>
          </div>
        </Badge>
      ) : isSyncing ? (
        <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-none px-4 py-2 flex items-center gap-2 shadow-2xl rounded-full">
          <RefreshCw size={16} className="animate-spin" />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-black uppercase tracking-tighter">Sincronizando</span>
            <span className="text-[8px] font-bold opacity-80">
              {pendingCount} {pendingCount === 1 ? 'ACCIÓN PENDIENTE' : 'ACCIONES PENDIENTES'}
            </span>
          </div>
        </Badge>
      ) : (
        <Badge className="bg-green-600 hover:bg-green-600 text-white border-none px-4 py-2 flex items-center gap-2 shadow-2xl rounded-full">
          <CheckCircle2 size={16} />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-black uppercase tracking-tighter">Sincronización completa</span>
            <span className="text-[8px] font-bold opacity-80">CONECTADO AL SERVIDOR CENTRAL</span>
          </div>
        </Badge>
      )}
    </div>
  );
}
