'use server';

import { Client, Truck, Hub, OptimizedRouteProposal } from "@/app/lib/types";
import { calculateDistance } from "@/lib/utils/tracking-math";

/**
 * @fileOverview Motor de optimización de rutas con Heurística de Barrido Geográfico y Asignación por Eficiencia.
 * 1. Agrupa paradas por corredores lógicos.
 * 2. Secuencia las entregas para minimizar km.
 * 3. ASIGNACIÓN EFICIENTE: Cruza el consumo del camión con el largo de la ruta.
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
  
  // 1. Crear grupos de paradas (Clusters geográficos)
  const clusters: Client[][] = [];

  for (let i = 0; i < numVehicles && unvisited.length > 0; i++) {
    const currentGroup: Client[] = [];
    
    // Encontrar la parada más lejana a la base (define la región/ancla)
    let furthestIdx = -1;
    let maxDistFromBase = -1;

    unvisited.forEach((s, idx) => {
      const d = calculateDistance(startHub.lat, startHub.lng, s.address.lat!, s.address.lng!);
      if (d > maxDistFromBase) {
        maxDistFromBase = d;
        furthestIdx = idx;
      }
    });

    if (furthestIdx !== -1) {
      const anchorStop = unvisited[furthestIdx];
      currentGroup.push(anchorStop);
      unvisited.splice(furthestIdx, 1);

      // Llenar el grupo con paradas cercanas al ANCLA
      while (currentGroup.length < targetsPerTruck && unvisited.length > 0) {
        let closestToAnchorIdx = -1;
        let minDistanceToAnchor = Infinity;
        const lastAdded = currentGroup[currentGroup.length - 1];

        unvisited.forEach((s, idx) => {
          const d = calculateDistance(lastAdded.address.lat!, lastAdded.address.lng!, s.address.lat!, s.address.lng!);
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

  // 2. Secuenciar cada cluster y calcular su distancia total
  const routePlans = clusters.map(group => {
    const orderedStops: Client[] = [];
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;
    const pool = [...group];

    while (pool.length > 0) {
      let nextIdx = -1;
      let minDist = Infinity;
      pool.forEach((s, idx) => {
        const d = calculateDistance(currentLat, currentLng, s.address.lat!, s.address.lng!);
        if (d < minDist) {
          minDist = d;
          nextIdx = idx;
        }
      });
      const selected = pool.splice(nextIdx, 1)[0];
      orderedStops.push(selected);
      currentLat = selected.address.lat!;
      currentLng = selected.address.lng!;
    }

    // Calcular distancia total (Ida + Paradas + Retorno)
    let totalDist = 0;
    let cursorLat = startHub.lat;
    let cursorLng = startHub.lng;

    orderedStops.forEach(s => {
      totalDist += calculateDistance(cursorLat, cursorLng, s.address.lat!, s.address.lng!);
      cursorLat = s.address.lat!;
      cursorLng = s.address.lng!;
    });
    totalDist += calculateDistance(cursorLat, cursorLng, endHub.lat, endHub.lng);

    return {
      stops: orderedStops,
      distance: Math.round(totalDist),
      duration: Math.round((totalDist / 60) * 60) + (orderedStops.length * 30)
    };
  });

  // 3. ASIGNACIÓN POR EFICIENCIA
  // Ordenar Planes de Ruta por distancia (DESC: más largo primero)
  const sortedPlans = [...routePlans].sort((a, b) => b.distance - a.distance);
  
  // Ordenar Camiones por consumo (ASC: menos gasta primero)
  const sortedTrucks = [...trucks].sort((a, b) => (a.avgConsumption || 32) - (b.avgConsumption || 32));

  // Combinar: Camión económico -> Ruta larga
  const finalProposals: OptimizedRouteProposal[] = sortedPlans.map((plan, idx) => {
    const assignedTruck = sortedTrucks[idx] || sortedTrucks[0]; // Fallback si hay desajuste
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
