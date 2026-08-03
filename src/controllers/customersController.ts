import { Request, Response } from 'express';
import { createCustomer, listCustomers } from '../services/customerService.js';

export async function getCustomers(_req: Request, res: Response) {
  try {
    const data = await listCustomers();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}

export async function postCustomer(req: Request, res: Response) {
  try {
    const payload = await createCustomer(req.body);
    res.status(201).json({ success: true, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}
