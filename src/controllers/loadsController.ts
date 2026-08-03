import { Request, Response } from 'express';
import { createLoad, deleteLoad, listLoads, updateLoad } from '../services/loadService.js';
import { requireTenantId } from '../utils/tenant.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getLoads(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const result = await listLoads(tenantId, parseListOptions(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postLoad(req: Request, res: Response) {
  try {
    const payload = await createLoad(req.body);
    res.status(201).json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function putLoad(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const payload = await updateLoad(tenantId, id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Load not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function removeLoad(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const deleted = await deleteLoad(tenantId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Load not found' });
      return;
    }

    res.json({ success: true, message: 'Load deleted' });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
