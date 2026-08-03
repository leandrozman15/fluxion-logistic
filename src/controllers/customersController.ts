import { Request, Response } from 'express';
import { createCustomer, listCustomers } from '../services/customerService.js';
import { requireTenantIdFromAuth } from '../utils/tenant.js';

export async function getCustomers(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const data = await listCustomers(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postCustomer(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const payload = await createCustomer({ ...req.body, tenantId });
    res.status(201).json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
