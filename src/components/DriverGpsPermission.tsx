'use client';

import { useEffect, useState } from "react";
import { MapPin, AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type PermissionState = 'checking' | 'granted' | 'prompt' | 'denied' | 'unsupported';

/**
 * Pide permiso de geolocalización apenas se monta la app del chofer, en vez de
 * esperar a que abra un viaje puntual (única forma de garantizar que la telemetría
 * en tiempo real ya tenga permiso concedido cuando el viaje arranca).
 */
export function DriverGpsPermission() {
  const [status, setStatus] = useState<PermissionState>('checking');

  const requestPermission = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setStatus('granted'),
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }

    if ('permissions' in navigator) {
      let permissionStatus: PermissionStatus | null = null;

      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          permissionStatus = result;
          setStatus(result.state as PermissionState);

          if (result.state === 'prompt') {
            // Dispara el popup nativo del navegador de una vez, sin esperar interacción.
            requestPermission();
          }

          result.onchange = () => setStatus(result.state as PermissionState);
        })
        .catch(() => {
          // Navegador sin soporte para Permissions API (ej. Safari/iOS): pedir directo.
          requestPermission();
        });

      return () => {
        if (permissionStatus) permissionStatus.onchange = null;
      };
    }

    requestPermission();
  }, []);

  if (status === 'granted' || status === 'checking' || status === 'unsupported') {
    return null;
  }

  return (
    <Alert variant={status === 'denied' ? 'destructive' : 'default'} className="mb-4">
      {status === 'denied' ? <AlertTriangle className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
      <AlertTitle>
        {status === 'denied' ? 'GPS bloqueado' : 'Se necesita acceso al GPS'}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {status === 'denied'
            ? 'El permiso de ubicación está denegado. Habilitalo en la configuración del navegador/teléfono para poder transmitir tu posición en tiempo real durante los viajes.'
            : 'Esta app necesita tu ubicación para transmitir en tiempo real durante los viajes.'}
        </span>
        <Button size="sm" variant="outline" className="w-fit" onClick={requestPermission}>
          {status === 'denied' ? 'Reintentar' : 'Habilitar GPS'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
