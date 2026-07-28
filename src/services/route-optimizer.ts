'use server';

import { Client, Truck, Hub, OptimizedRouteProposal } from "@/app/lib/types";
import { calculateDistance } from "@/lib/utils/tracking-math";

/**
 * @fileOverview Motor de optimización de rutas con Heurística de Barrido Geográfico.
 * Implementa una estrategia de "Semilla Lejana": identifica los destinos más extremos
 * y agrupa las paradas cercanas a ellos para cubrir corredores lógicos (ej. Rosario-Córdoba).
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
  
  const proposals: OptimizedRouteProposal[] = trucks.slice(0, numVehicles).map(t => ({
    truckId: t.id,
    truckPlate: t.plate,
    driverId: t.assignedDriverId || 'none',
    stops: [],
    totalDistanceKm: 0,
    estimatedDurationMinutes: 0
  }));

  /**
   * ESTRATEGIA: Regionalización por Extremos
   * 1. Buscamos el punto más lejano a la base que no haya sido visitado.
   * 2. Lo usamos como "ancla" para un camión.
   * 3. Llenamos ese camión con las paradas más cercanas a esa ancla.
   */
  for (let i = 0; i < numVehicles && unvisited.length > 0; i++) {
    const currentProp = proposals[i];
    
    // Encontrar la parada más lejana a la base (define la región/corredor)
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
      currentProp.stops.push(anchorStop);
      unvisited.splice(furthestIdx, 1);

      // Llenar el resto del camión con puntos cercanos al ANCLA (no a la base)
      // Esto asegura que Rosario y Córdoba (cercanos entre sí) se queden juntos
      while (currentProp.stops.length < targetsPerTruck && unvisited.length > 0) {
        let closestToAnchorIdx = -1;
        let minDistanceToAnchor = Infinity;
        
        // Referencia: el último punto agregado a esta propuesta
        const lastStop = currentProp.stops[currentProp.stops.length - 1];

        unvisited.forEach((s, idx) => {
          const d = calculateDistance(lastStop.address.lat!, lastStop.address.lng!, s.address.lat!, s.address.lng!);
          if (d < minDistanceToAnchor) {
            minDistanceToAnchor = d;
            closestToAnchorIdx = idx;
          }
        });

        if (closestToAnchorIdx !== -1) {
          currentProp.stops.push(unvisited[closestToAnchorIdx]);
          unvisited.splice(closestToAnchorIdx, 1);
        }
      }
    }
  }

  // 3. Post-procesamiento: Secuenciación y Cálculo Final
  proposals.forEach(prop => {
    if (prop.stops.length === 0) return;

    // Re-ordenar las paradas de la propuesta para que sean óptimas desde la base
    // (Orden de entrega: Base -> Cerca -> Lejos -> Retorno)
    const orderedStops: Client[] = [];
    let currentLat = startHub.lat;
    let currentLng = startHub.lng;
    const pool = [...prop.stops];

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

    prop.stops = orderedStops;

    // Totales
    let totalDist = 0;
    let cursorLat = startHub.lat;
    let cursorLng = startHub.lng;

    prop.stops.forEach(s => {
      totalDist += calculateDistance(cursorLat, cursorLng, s.address.lat!, s.address.lng!);
      cursorLat = s.address.lat!;
      cursorLng = s.address.lng!;
    });

    // Retorno a base final
    totalDist += calculateDistance(cursorLat, cursorLng, endHub.lat, endHub.lng);

    prop.totalDistanceKm = Math.round(totalDist);
    prop.estimatedDurationMinutes = Math.round((totalDist / 60) * 60) + (prop.stops.length * 30);
  });

  return proposals;
}
