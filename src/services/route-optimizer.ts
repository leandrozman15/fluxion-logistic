'use server';

import { Client, Truck, Hub, OptimizedRouteProposal } from "@/app/lib/types";
import { calculateDistance } from "@/lib/utils/tracking-math";

/**
 * @fileOverview Motor de optimización de rutas mejorado (Heurística de Clustering + Vecino Cercano).
 * Distribuye clientes agrupándolos por regiones geográficas para evitar que los camiones
 * se crucen o realicen trayectos ineficientes de largo alcance.
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
  const targetsPerTruck = Math.ceil(unvisited.length / numVehicles);
  
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
   * NUEVA LÓGICA: Llenado por Bloques (Clustering Greedy)
   * En lugar de repartir 1 a 1 (round-robin), permitimos que cada camión 
   * complete su 'cuota' de paradas cercanas entre sí.
   */
  for (let i = 0; i < numVehicles; i++) {
    const currentProp = proposals[i];
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;

    // Cada camión intenta tomar sus paradas más cercanas consecutivamente
    for (let j = 0; j < targetsPerTruck && unvisited.length > 0; j++) {
      let closestIdx = -1;
      let minDistance = Infinity;

      unvisited.forEach((stop, idx) => {
        const d = calculateDistance(currentLat, currentLng, stop.address.lat!, stop.address.lng!);
        if (d < minDistance) {
          minDistance = d;
          closestIdx = idx;
        }
      });

      if (closestIdx !== -1) {
        const selectedStop = unvisited[closestIdx];
        currentProp.stops.push(selectedStop);
        
        // Actualizar posición de referencia al punto recién agregado
        currentLat = selectedStop.address.lat!;
        currentLng = selectedStop.address.lng!;
        
        // Remover de la lista global de pendientes
        unvisited.splice(closestIdx, 1);
      }
    }
  }

  // Si sobraron paradas por redondeo, se las damos al último camión
  if (unvisited.length > 0) {
    const lastProp = proposals[numVehicles - 1];
    let lastLat = lastProp.stops.length > 0 
      ? lastProp.stops[lastProp.stops.length - 1].address.lat! 
      : startHub.lat;
    let lastLng = lastProp.stops.length > 0 
      ? lastProp.stops[lastProp.stops.length - 1].address.lng! 
      : startHub.lng;

    while (unvisited.length > 0) {
      let closestIdx = -1;
      let minDistance = Infinity;

      unvisited.forEach((stop, idx) => {
        const d = calculateDistance(lastLat, lastLat, stop.address.lat!, stop.address.lng!);
        if (d < minDistance) {
          minDistance = d;
          closestIdx = idx;
        }
      });

      if (closestIdx !== -1) {
        const stop = unvisited[closestIdx];
        lastProp.stops.push(stop);
        lastLat = stop.address.lat!;
        lastLng = stop.address.lng!;
        unvisited.splice(closestIdx, 1);
      }
    }
  }

  // 3. Cálculo final de distancias y tiempos por propuesta
  proposals.forEach(prop => {
    if (prop.stops.length === 0) return;

    let totalDist = 0;
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;

    // Trayecto secuencial optimizado
    prop.stops.forEach(s => {
      const d = calculateDistance(currentLat, currentLng, s.address.lat!, s.address.lng!);
      totalDist += d;
      currentLat = s.address.lat!;
      currentLng = s.address.lng!;
    });

    // Tramo Final de retorno a la Sede de Destino
    totalDist += calculateDistance(currentLat, currentLng, endHub.lat, endHub.lng);

    prop.totalDistanceKm = Math.round(totalDist);
    
    // Cálculo estimado: 60km/h promedio + 30 min por trámite de descarga en cada punto
    prop.estimatedDurationMinutes = Math.round((totalDist / 60) * 60) + (prop.stops.length * 30);
  });

  return proposals;
}
