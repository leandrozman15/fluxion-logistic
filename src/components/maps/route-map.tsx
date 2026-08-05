'use client';

import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

type LatLng = {
  lat: number;
  lng: number;
};

type RouteMapProps = {
  currentPosition: LatLng | null;
  routeHistory: LatLng[];
  destination: LatLng | null;
};

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];

// Este componente se carga con next/dynamic(ssr:false), por lo que "L" (leaflet) y "window"
// siempre están disponibles acá. Sin un icono custom, react-leaflet usa el marcador default
// de Leaflet, cuyas imágenes (marker-icon.png) no se resuelven con el bundler de Next y el
// camión terminaba sin aparecer en el mapa.
const truckIcon = L.divIcon({
  className: 'custom-truck-icon',
  html: `
    <div class="relative">
      <div class="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9V4"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/>
          <circle cx="7" cy="18" r="2"/>
          <circle cx="17" cy="18" r="2"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const destinationIcon = L.divIcon({
  className: 'custom-destination-icon',
  html: `<div class="bg-red-600 text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// MapContainer solo aplica "center" en el primer render: react-leaflet no vuelve a
// centrar el mapa por su cuenta cuando cambian las coordenadas. Sin esto, el camión se
// actualizaba en el mapa pero la vista se quedaba fija en la posición inicial (o en el
// centro por defecto), dando la sensación de que el ícono "no estaba en su ubicación exacta".
function FollowPosition({ position }: { position: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);

  return null;
}

export default function RouteMap({ currentPosition, routeHistory, destination }: RouteMapProps) {
  const center: [number, number] = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : destination
      ? [destination.lat, destination.lng]
      : DEFAULT_CENTER;

  const polylinePoints: [number, number][] = routeHistory
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => [point.lat, point.lng]);

  return (
    <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      <FollowPosition position={currentPosition ? [currentPosition.lat, currentPosition.lng] : null} />

      {polylinePoints.length > 1 && <Polyline positions={polylinePoints} color="#2563eb" weight={4} />}

      {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />}

      {currentPosition && <Marker position={[currentPosition.lat, currentPosition.lng]} icon={truckIcon} />}
    </MapContainer>
  );
}
