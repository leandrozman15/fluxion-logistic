
'use server';

import { PendingRemito, Truck, Hub, OptimizedRouteProposal } from "@/app/lib/types";
import { calculateDistance } from "@/lib/utils/tracking-math";

/**
 * @fileOverview Motor de optimización de rutas con Heurística de Barrido Geográfico y Asignación por Eficiencia.
 * 1. Agrupa remitos por corredores lógicos (Clusters).
 * 2. Secuencia las entregas para minimizar km (Nearest Neighbor).
 * 3. ASIGNACIÓN EFICIENTE: Cruza el consumo del camión con el largo de la ruta.
 */

export async function optimizeDistribution(
  stops: PendingRemito[],
  trucks: Truck[],
  startHub: Hub,
  endHub: Hub
): Promise<OptimizedRouteProposal[]> {
  if (stops.length === 0 || trucks.length === 0) return [];

  const unvisited = [...stops];
  const numVehicles = Math.min(trucks.length, stops.length);
  const targetsPerTruck = Math.ceil(unvisited.length / numVehicles);
  
  // 1. Crear grupos de paradas (Clusters geográficos)
  const clusters: PendingRemito[][] = [];

  for (let i = 0; i < numVehicles && unvisited.length > 0; i++) {
    const currentGroup: PendingRemito[] = [];
    
    // Encontrar la parada más lejana a la base (define el ancla de la zona)
    let furthestIdx = -1;
    let maxDistFromBase = -1;

    unvisited.forEach((s, idx) => {
      const d = calculateDistance(startHub.lat, startHub.lng, s.lat || 0, s.lng || 0);
      if (d > maxDistFromBase) {
        maxDistFromBase = d;
        furthestIdx = idx;
      }
    });

    if (furthestIdx !== -1) {
      const anchorStop = unvisited[furthestIdx];
      currentGroup.push(anchorStop);
      unvisited.splice(furthestIdx, 1);

      // Llenar el grupo con paradas cercanas al ANCLA de la zona
      while (currentGroup.length < targetsPerTruck && unvisited.length > 0) {
        let closestToAnchorIdx = -1;
        let minDistanceToAnchor = Infinity;
        const lastAdded = currentGroup[currentGroup.length - 1];

        unvisited.forEach((s, idx) => {
          const d = calculateDistance(lastAdded.lat || 0, lastAdded.lng || 0, s.lat || 0, s.lng || 0);
          if (d < minDistanceToAnchor) {
            minDistanceToAnchor = d;
            closestToAnchorIdx = idx;
          }
        });

        if (closestToAnchorIdx !== -1) {
          currentGroup.push(unvisited[closestToAnchorIdx]);
          unvisited.splice(closestToAnchorIdx, 1);
        }
      }
      clusters.push(currentGroup);
    }
  }

  // 2. Secuenciar cada cluster (Hoja de ruta secuencial)
  const routePlans = clusters.map(group => {
    const orderedStops: PendingRemito[] = [];
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;
    const pool = [...group];

    while (pool.length > 0) {
      let nextIdx = -1;
      let minDist = Infinity;
      pool.forEach((s, idx) => {
        const d = calculateDistance(currentLat, currentLng, s.lat || 0, s.lng || 0);
        if (d < minDist) {
          minDist = d;
          nextIdx = idx;
        }
      });
      const selected = pool.splice(nextIdx, 1)[0];
      orderedStops.push(selected);
      currentLat = selected.lat || currentLat;
      currentLng = selected.lng || currentLng;
    }

    // Calcular distancia total del circuito (Base -> Paradas -> Retorno)
    let totalDist = 0;
    let cursorLat = startHub.lat;
    let cursorLng = startHub.lng;

    orderedStops.forEach(s => {
      totalDist += calculateDistance(cursorLat, cursorLng, s.lat || cursorLat, s.lng || cursorLng);
      cursorLat = s.lat || cursorLat;
      cursorLng = s.lng || cursorLng;
    });
    totalDist += calculateDistance(cursorLat, cursorLng, endHub.lat, endHub.lng);

    return {
      stops: orderedStops,
      distance: Math.round(totalDist),
      duration: Math.round((totalDist / 60) * 60) + (orderedStops.length * 30) // Asume 60km/h + 30min por parada
    };
  });

  // 3. ASIGNACIÓN POR EFICIENCIA (MATCHING)
  // Ordenar Planes de Ruta por distancia (DESC: la ruta más larga requiere el camión más eficiente)
  const sortedPlans = [...routePlans].sort((a, b) => b.distance - a.distance);
  
  // Ordenar Camiones por consumo (ASC: el que menos gasta primero)
  const sortedTrucks = [...trucks].sort((a, b) => (a.avgConsumption || 32) - (b.avgConsumption || 32));

  // Combinar: Camión económico -> Ruta larga
  const finalProposals: OptimizedRouteProposal[] = sortedPlans.map((plan, idx) => {
    const assignedTruck = sortedTrucks[idx] || sortedTrucks[0];
    return {
      truckId: assignedTruck.id,
      truckPlate: assignedTruck.plate,
      driverId: assignedTruck.assignedDriverId || 'none',
      stops: plan.stops,
      totalDistanceKm: plan.distance,
      estimatedDurationMinutes: plan.duration
    };
  });

  return finalProposals;
}
