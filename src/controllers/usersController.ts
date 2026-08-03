import { Request, Response } from 'express';
import { createAppUser, deleteAppUser, listAppUsers, updateAppUser } from '../services/appUserService.js';
import { requireTenantIdFromAuth } from '../utils/tenant.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getUsers(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const result = await listAppUsers(tenantId, parseListOptions(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postUser(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const payload = await createAppUser({ ...req.body, tenantId });
    res.status(201).json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function putUser(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await updateAppUser(tenantId, id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function removeUser(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteAppUser(tenantId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
