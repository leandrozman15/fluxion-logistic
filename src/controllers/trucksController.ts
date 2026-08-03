import { Request, Response } from 'express';
import { createTruck, deleteTruck, listTrucks, updateTruck } from '../services/truckService.js';
import { requireTenantIdFromAuth } from '../utils/tenant.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getTrucks(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const result = await listTrucks(tenantId, parseListOptions(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postTruck(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const payload = await createTruck({ ...req.body, tenantId });
    res.status(201).json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function putTruck(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await updateTruck(tenantId, id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Truck not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function removeTruck(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteTruck(tenantId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Truck not found' });
      return;
    }

    res.json({ success: true, message: 'Truck deleted' });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
