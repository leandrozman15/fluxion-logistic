import { Request, Response } from 'express';
import { createTenant, deleteTenant, listTenants, updateTenant } from '../services/tenantService.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getTenants(_req: Request, res: Response) {
  try {
    const result = await listTenants(parseListOptions(_req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function postTenant(req: Request, res: Response) {
  try {
    const payload = await createTenant(req.body);
    res.status(201).json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function putTenant(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await updateTenant(id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function removeTenant(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteTenant(id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }

    res.json({ success: true, message: 'Tenant deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}
