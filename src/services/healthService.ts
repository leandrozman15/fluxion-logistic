import { getHealthStatus } from '../controllers/healthController.js';

export function getHealthPayload() {
  return getHealthStatus();
}
