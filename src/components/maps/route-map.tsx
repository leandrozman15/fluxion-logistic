'use client';

import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';

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

      {polylinePoints.length > 1 && <Polyline positions={polylinePoints} color="#2563eb" weight={4} />}

      {destination && <Marker position={[destination.lat, destination.lng]} />}

      {currentPosition && <Marker position={[currentPosition.lat, currentPosition.lng]} />}
    </MapContainer>
  );
}
