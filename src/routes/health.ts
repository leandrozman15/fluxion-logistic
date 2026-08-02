import { Router } from 'express';
import { getHealthPayload } from '../services/healthService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getHealthPayload());
});

export default router;
