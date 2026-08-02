import { Router } from 'express';
import { createCustomer, listCustomers } from '../services/customerService.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const customers = await listCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const customer = await createCustomer(req.body);
    res.status(201).json({ success: true, message: 'Cliente creado', payload: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
