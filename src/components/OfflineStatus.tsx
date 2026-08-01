'use client';

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Componente que monitorea la conexión a internet.
 * Crucial para que el chofer sepa cuando está en zona sin señal.
 */
export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showSyncing, setShowSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowSyncing(true);
      // Ocultar el mensaje de sincronización después de unos segundos
      setTimeout(() => setShowSyncing(false), 4000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Estado inicial
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showSyncing) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-500">
      {!isOnline ? (
        <Badge className="bg-orange-600 hover:bg-orange-600 text-white border-none px-4 py-2 flex items-center gap-2 shadow-2xl rounded-full">
          <WifiOff size={16} className="animate-pulse" />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-black uppercase tracking-tighter">Modo Offline Activo</span>
            <span className="text-[8px] font-bold opacity-80">TRABAJANDO CON DATOS LOCALES</span>
          </div>
        </Badge>
      ) : (
        <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-none px-4 py-2 flex items-center gap-2 shadow-2xl rounded-full">
          <RefreshCw size={16} className="animate-spin" />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-black uppercase tracking-tighter">Sincronización en curso</span>
            <span className="text-[8px] font-bold opacity-80">CONECTADO AL SERVIDOR CENTRAL</span>
          </div>
        </Badge>
      )}
    </div>
  );
}
