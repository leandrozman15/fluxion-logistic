
/**
 * Utilitários matemáticos para telemetría e rastreamiento.
 */
import { toSafeDate } from "./date-utils";

export const STANDARD_HEAVY_CONSUMPTION = 32; // L/100km (Promedio camión pesado cargado)

/**
 * Calcula a distância entre dois pontos (Haversine Formula) em km.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula o consumo estimado de combustível (Litros) baseado na distância e consumo médio.
 */
export function estimateFuelLiters(distanceKm: number, avgConsumption = STANDARD_HEAVY_CONSUMPTION): number {
  if (distanceKm <= 0) return 0;
  return (distanceKm * avgConsumption) / 100;
}

/**
 * Calcula o consumo estimado de combustível (Litros/100km) baseado na velocidade.
 * Valores médios para caminhões pesados carregados.
 */
export function estimateFuelFactor(speed: number): number {
  if (speed < 1) return 2.0; // Consumo em marcha lenta (L/h)
  if (speed < 30) return 45;
  if (speed < 50) return 38;
  if (speed < 70) return 32;
  if (speed <= 85) return 28; // Faixa ótima
  if (speed < 100) return 33;
  return 42; // Excesso de velocidad aumenta el consumo drasticamente
}

/**
 * Calcula o ETA ajustado ponderando múltiplos fatores.
 */
export function calculateAdjustedETA(
  distanceRemaining: number,
  currentSpeed: number,
  avgSpeedRecent: number,
  historicalRouteSpeed: number = 65
): number {
  if (distanceRemaining <= 0) return 0;

  // Ponderación: 40% Velocidad Actual, 30% Média Recente, 30% Histórico
  const weightedSpeed = (currentSpeed * 0.4) + (avgSpeedRecent * 0.3) + (historicalRouteSpeed * 0.3);
  
  // Garantir velocidad mínima para cálculo si está parado
  const effectiveSpeed = Math.max(weightedSpeed, 10); 

  return (distanceRemaining / effectiveSpeed) * 60; // Retorna em minutos
}

/**
 * Calcula el retraso acumulado comparando el progreso real contra el plan ideal.
 */
export function calculateLiveDelay(
  tripStartedAt: any,
  distanceTraveled: number,
  plannedAvgSpeed: number = 65
): number {
  const start = toSafeDate(tripStartedAt);
  if (!start) return 0;

  const now = new Date();
  const elapsedMinutes = (now.getTime() - start.getTime()) / (1000 * 60);
  const expectedMinutes = (distanceTraveled / plannedAvgSpeed) * 60;

  // El resultado es la diferencia entre el tiempo real consumido y el tiempo ideal para esa distancia
  return Math.round(elapsedMinutes - expectedMinutes);
}

/**
 * Ordena un conjunto de puntos con coordenadas por vecino más cercano (heurística greedy),
 * partiendo de un punto de inicio dado. Los puntos sin lat/lng van al final (requieren
 * resolución manual de dirección antes de poder ubicarlos en la secuencia).
 */
export function sequenceByNearestNeighbor<T extends { lat?: number | null; lng?: number | null }>(
  points: T[],
  startLat: number,
  startLng: number
): T[] {
  const withCoords = points.filter((p): p is T & { lat: number; lng: number } => typeof p.lat === 'number' && typeof p.lng === 'number');
  const withoutCoords = points.filter((p) => !(typeof p.lat === 'number' && typeof p.lng === 'number'));

  const pool = [...withCoords];
  const ordered: T[] = [];
  let curLat = startLat;
  let curLng = startLng;

  while (pool.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    pool.forEach((p, idx) => {
      const dist = calculateDistance(curLat, curLng, p.lat, p.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    const [next] = pool.splice(bestIdx, 1);
    ordered.push(next);
    curLat = next.lat;
    curLng = next.lng;
  }

  return [...ordered, ...withoutCoords];
}

