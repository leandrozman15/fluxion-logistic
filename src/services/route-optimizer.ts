
'use server';

import { Client, Truck, Hub, OptimizedRouteProposal } from "@/app/lib/types";
import { calculateDistance } from "@/lib/utils/tracking-math";

/**
 * @fileOverview Motor de optimización de rutas (VRP - Vehicle Routing Problem).
 * Divide una lista de clientes entre una flota de camiones seleccionada
 * utilizando el algoritmo de Vecino más Cercano para asegurar rutas secuenciales.
 */

export async function optimizeDistribution(
  stops: Client[],
  trucks: Truck[],
  startHub: Hub,
  endHub: Hub
): Promise<OptimizedRouteProposal[]> {
  if (stops.length === 0 || trucks.length === 0) return [];

  const numVehicles = Math.min(trucks.length, stops.length);
  const proposals: OptimizedRouteProposal[] = trucks.slice(0, numVehicles).map(t => ({
    truckId: t.id,
    truckPlate: t.plate,
    driverId: t.assignedDriverId,
    stops: [],
    totalDistanceKm: 0,
    estimatedDurationMinutes: 0
  }));

  // 1. Clasificación inicial por cercanía a la base para asignar "zonas" a cada camión
  // Esto evita que las rutas se crucen demasiado
  const sortedStops = [...stops].sort((a, b) => {
    const distA = calculateDistance(startHub.lat, startHub.lng, a.address.lat!, a.address.lng!);
    const distB = calculateDistance(startHub.lat, startHub.lng, b.address.lat!, b.address.lng!);
    return distA - distB;
  });

  // 2. Reparto de clientes entre vehículos (Greedy clustering)
  const batchSize = Math.ceil(stops.length / numVehicles);
  const clusters: Client[][] = [];
  for (let i = 0; i < numVehicles; i++) {
    clusters.push(sortedStops.slice(i * batchSize, (i + 1) * batchSize));
  }

  // 3. Optimización de la secuencia dentro de cada cluster (Nearest Neighbor TSP)
  // "Desde base a punto 1, luego 2, luego 3..."
  for (let i = 0; i < numVehicles; i++) {
    const cluster = clusters[i];
    if (cluster.length === 0) continue;

    const optimizedSequence: Client[] = [];
    let unvisited = [...cluster];
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;
    let totalDist = 0;

    while (unvisited.length > 0) {
      // Buscar el punto más cercano a la ubicación actual
      let closestIdx = 0;
      let minDistance = Infinity;

      unvisited.forEach((stop, idx) => {
        const d = calculateDistance(currentLat, currentLng, stop.address.lat!, stop.address.lng!);
        if (d < minDistance) {
          minDistance = d;
          closestIdx = idx;
        }
      });

      const nextStop = unvisited[closestIdx];
      optimizedSequence.push(nextStop);
      totalDist += minDistance;
      
      // Mover el puntero a la ubicación del cliente actual
      currentLat = nextStop.address.lat!;
      currentLng = nextStop.address.lng!;
      
      // Quitar de la lista de pendientes
      unvisited.splice(closestIdx, 1);
    }

    // El último tramo es hacia la Sede de Destino Final
    totalDist += calculateDistance(currentLat, currentLng, endHub.lat, endHub.lng);

    proposals[i].stops = optimizedSequence;
    proposals[i].totalDistanceKm = Math.round(totalDist);
    // Cálculo estimado: 60km/h de media + 25 min por parada de descarga/trámite
    proposals[i].estimatedDurationMinutes = Math.round((totalDist / 60) * 60) + (optimizedSequence.length * 25);
  }

  return proposals;
}
