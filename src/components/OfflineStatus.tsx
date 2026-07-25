'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertCircle, RefreshCw, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showSyncing, setShowSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowSyncing(true);
      setTimeout(() => setShowSyncing(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showSyncing) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2">
      {!isOnline ? (
        <Badge className="bg-orange-600 text-white border-none px-3 py-1 flex items-center gap-2 shadow-xl">
          <WifiOff size={14} className="animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Modo Offline Activo - Trabajando en Caché</span>
        </Badge>
      ) : (
        <Badge className="bg-green-600 text-white border-none px-3 py-1 flex items-center gap-2 shadow-xl">
          <RefreshCw size={14} className="animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Sincronizando datos con la Central...</span>
        </Badge>
      )}
    </div>
  );
}
