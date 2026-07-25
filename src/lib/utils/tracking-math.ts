
/**
 * Utilitários matemáticos para telemetria e rastreamento.
 */

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
  return 42; // Excesso de velocidade aumenta o consumo drasticamente
}

/**
 * Calcula o ETA ajustado ponderando múltiplos fatores.
 */
export function calculateAdjustedETA(
  distanceRemaining: number,
  currentSpeed: number,
  avgSpeedLast10Min: number,
  historicalRouteSpeed: number = 70
): number {
  if (distanceRemaining <= 0) return 0;

  // Ponderação: 40% Velocidade Atual, 30% Média Recente, 30% Histórico
  const weightedSpeed = (currentSpeed * 0.4) + (avgSpeedLast10Min * 0.3) + (historicalRouteSpeed * 0.3);
  
  // Garantir velocidade mínima para cálculo se estiver parado
  const effectiveSpeed = Math.max(weightedSpeed, 10); 

  return (distanceRemaining / effectiveSpeed) * 60; // Retorna em minutos
}
