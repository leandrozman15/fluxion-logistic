import { Request, Response } from 'express';
import { createDriver, deleteDriver, listDrivers, updateDriver } from '../services/driverService.js';
import { parseListOptions } from '../utils/listQuery.js';
import { requireTenantIdFromAuth } from '../utils/tenant.js';

export async function getDrivers(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const result = await listDrivers(tenantId, parseListOptions(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postDriver(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const payload = await createDriver({ ...req.body, tenantId });
    res.status(201).json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function putDriver(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await updateDriver(tenantId, id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Driver not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function removeDriver(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteDriver(tenantId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Driver not found' });
      return;
    }

    res.json({ success: true, message: 'Driver deleted' });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
