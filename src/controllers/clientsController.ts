import { Request, Response } from 'express';
import { createClient, deleteClient, listClients, updateClient } from '../services/clientService.js';
import { requireTenantId } from '../utils/tenant.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getClients(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const result = await listClients(tenantId, parseListOptions(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postClient(req: Request, res: Response) {
  try {
    const payload = await createClient(req.body);
    res.status(201).json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function putClient(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const payload = await updateClient(tenantId, id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Client not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function removeClient(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const deleted = await deleteClient(tenantId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Client not found' });
      return;
    }

    res.json({ success: true, message: 'Client deleted' });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
