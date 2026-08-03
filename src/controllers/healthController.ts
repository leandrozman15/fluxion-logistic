import { Request, Response } from 'express';
import { getHealthPayload } from '../services/healthService.js';

export function getHealth(_req: Request, res: Response) {
  res.json(getHealthPayload());
}
