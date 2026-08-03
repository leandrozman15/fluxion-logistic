import { Request, Response } from 'express';
import { createQuotation, deleteQuotation, listQuotations, updateQuotation } from '../services/quotationService.js';
import { requireTenantId } from '../utils/tenant.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getQuotations(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const result = await listQuotations(tenantId, parseListOptions(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postQuotation(req: Request, res: Response) {
  try {
    const payload = await createQuotation(req.body);
    res.status(201).json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function putQuotation(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await updateQuotation(tenantId, id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Quotation not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function removeQuotation(req: Request, res: Response) {
  try {
    const tenantId = requireTenantId(req.query.tenantId);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteQuotation(tenantId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Quotation not found' });
      return;
    }

    res.json({ success: true, message: 'Quotation deleted' });
  } catch (error) {
    const status = (error as Error).message === 'tenantId is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
