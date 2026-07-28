'use server';

import { Client, Truck, Hub, OptimizedRouteProposal } from "@/app/lib/types";
import { calculateDistance } from "@/lib/utils/tracking-math";

/**
 * @fileOverview Motor de optimización de rutas (VRP - Vehicle Routing Problem).
 * Distribuye clientes entre una flota utilizando un algoritmo de Vecino más Cercano balanceado
 * para asegurar que cada camión siga una secuencia lógica de entregas.
 */

export async function optimizeDistribution(
  stops: Client[],
  trucks: Truck[],
  startHub: Hub,
  endHub: Hub
): Promise<OptimizedRouteProposal[]> {
  if (stops.length === 0 || trucks.length === 0) return [];

  const unvisited = [...stops];
  const numVehicles = Math.min(trucks.length, stops.length);
  
  // Inicializar propuestas
  const proposals: OptimizedRouteProposal[] = trucks.slice(0, numVehicles).map(t => ({
    truckId: t.id,
    truckPlate: t.plate,
    driverId: t.assignedDriverId || 'none',
    stops: [],
    totalDistanceKm: 0,
    estimatedDurationMinutes: 0
  }));

  /**
   * Lógica de Asignación Secuencial (Nearest Neighbor Balanceado):
   * En lugar de dividir en trozos fijos, recorremos los vehículos y les asignamos
   * el punto más cercano a su ÚLTIMA ubicación conocida (empezando por la base).
   */
  let vehicleIdx = 0;
  while (unvisited.length > 0) {
    const currentProp = proposals[vehicleIdx];
    
    // Determinar última ubicación del camión (Base o último cliente asignado)
    const lastLoc = currentProp.stops.length > 0 
      ? { lat: currentProp.stops[currentProp.stops.length - 1].address.lat!, lng: currentProp.stops[currentProp.stops.length - 1].address.lng! }
      : { lat: startHub.lat, lng: startHub.lng };

    // Buscar el punto más cercano a esa ubicación
    let closestIdx = -1;
    let minDistance = Infinity;

    unvisited.forEach((stop, idx) => {
      const d = calculateDistance(lastLoc.lat, lastLoc.lng, stop.address.lat!, stop.address.lng!);
      if (d < minDistance) {
        minDistance = d;
        closestIdx = idx;
      }
    });

    if (closestIdx !== -1) {
      currentProp.stops.push(unvisited[closestIdx]);
      unvisited.splice(closestIdx, 1);
    }

    // Pasar al siguiente vehículo (para balancear carga)
    vehicleIdx = (vehicleIdx + 1) % numVehicles;
  }

  // 3. Cálculo final de distancias y tiempos por propuesta
  proposals.forEach(prop => {
    if (prop.stops.length === 0) return;

    let totalDist = 0;
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;

    // Tramo 1 a N (Secuencial)
    prop.stops.forEach(s => {
      const d = calculateDistance(currentLat, currentLng, s.address.lat!, s.address.lng!);
      totalDist += d;
      currentLat = s.address.lat!;
      currentLng = s.address.lng!;
    });

    // Tramo Final a la Sede de Destino
    totalDist += calculateDistance(currentLat, currentLng, endHub.lat, endHub.lng);

    prop.totalDistanceKm = Math.round(totalDist);
    
    // Cálculo estimado de tiempo: 60km/h promedio + 30 min por trámite de descarga
    prop.estimatedDurationMinutes = Math.round((totalDist / 60) * 60) + (prop.stops.length * 30);
  });

  return proposals;
}
