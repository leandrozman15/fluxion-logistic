
'use server';

import { Client, Truck, Hub, OptimizedRouteProposal } from "@/app/lib/types";
import { calculateDistance } from "@/lib/utils/tracking-math";

/**
 * @fileOverview Motor de optimización de rutas (VRP - Vehicle Routing Problem).
 * Divide una lista de clientes entre una flota de camiones seleccionada
 * minimizando la distancia total recorrida.
 */

export async function optimizeDistribution(
  stops: Client[],
  trucks: Truck[],
  startHub: Hub
): Promise<OptimizedRouteProposal[]> {
  if (stops.length === 0 || trucks.length === 0) return [];

  // Implementación de K-Means básico para agrupar clientes por cercanía
  // En producción real, aquí se llamaría a Google Cloud Route Optimization API
  
  const numVehicles = Math.min(trucks.length, stops.length);
  const proposals: OptimizedRouteProposal[] = trucks.slice(0, numVehicles).map(t => ({
    truckId: t.id,
    truckPlate: t.plate,
    driverId: t.assignedDriverId,
    stops: [],
    totalDistanceKm: 0,
    estimatedDurationMinutes: 0
  }));

  // Paso 1: Inicializar centroides con clientes aleatorios o equidistantes
  // Por simplicidad en este prototipo, distribuimos equitativamente los clientes
  // basándonos en su posición relativa al Hub central.
  
  const sortedStops = [...stops].sort((a, b) => {
    const distA = calculateDistance(startHub.lat, startHub.lng, a.address.lat!, a.address.lng!);
    const distB = calculateDistance(startHub.lat, startHub.lng, b.address.lat!, b.address.lng!);
    return distA - distB;
  });

  // Paso 2: Asignación Greedy (Cercanía inmediata)
  // Agrupamos clientes por cuadrantes o simplemente dividimos el array ordenado
  const batchSize = Math.ceil(stops.length / numVehicles);
  
  for (let i = 0; i < numVehicles; i++) {
    const truckStops = sortedStops.slice(i * batchSize, (i + 1) * batchSize);
    proposals[i].stops = truckStops;
    
    // Calcular distancia estimada de la ruta para este camión
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;
    let totalDist = 0;

    truckStops.forEach(stop => {
      const d = calculateDistance(currentLat, currentLng, stop.address.lat!, stop.address.lng!);
      totalDist += d;
      currentLat = stop.address.lat!;
      currentLng = stop.address.lng!;
    });

    // Vuelta al Hub
    totalDist += calculateDistance(currentLat, currentLng, startHub.lat, startHub.lng);
    
    proposals[i].totalDistanceKm = Math.round(totalDist);
    proposals[i].estimatedDurationMinutes = Math.round((totalDist / 60) * 60) + (truckStops.length * 20); // 20 min por parada
  }

  return proposals;
}
