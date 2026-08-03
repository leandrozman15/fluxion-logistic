import { Request, Response } from 'express';
import { createDriver, deleteDriver, listDrivers, updateDriver } from '../services/driverService.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getDrivers(_req: Request, res: Response) {
  try {
    const result = await listDrivers(parseListOptions(_req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function postDriver(req: Request, res: Response) {
  try {
    const payload = await createDriver(req.body);
    res.status(201).json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function putDriver(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await updateDriver(id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Driver not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function removeDriver(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteDriver(id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Driver not found' });
      return;
    }

    res.json({ success: true, message: 'Driver deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}
