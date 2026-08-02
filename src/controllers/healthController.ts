export function getHealthStatus() {
  return {
    status: 'ok',
    service: 'fluxion-logistic-backend',
    timestamp: new Date().toISOString(),
  };
}
