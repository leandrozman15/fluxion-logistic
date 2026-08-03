import { Request, Response } from 'express';
import { createProduct, deleteProduct, listProducts, updateProduct } from '../services/productService.js';
import { requireTenantIdFromAuth } from '../utils/tenant.js';
import { parseListOptions } from '../utils/listQuery.js';

export async function getProducts(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const result = await listProducts(tenantId, parseListOptions(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function postProduct(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const payload = await createProduct({ ...req.body, tenantId });
    res.status(201).json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function putProduct(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const payload = await updateProduct(tenantId, id, req.body);

    if (!payload) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    res.json({ success: true, payload });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}

export async function removeProduct(req: Request, res: Response) {
  try {
    const tenantId = requireTenantIdFromAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const deleted = await deleteProduct(tenantId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    const status = (error as Error).message === 'tenant context is required' ? 400 : 500;
    res.status(status).json({ success: false, message: (error as Error).message });
  }
}
