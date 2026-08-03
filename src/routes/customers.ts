import { Router } from 'express';
import { getCustomers, postCustomer } from '../controllers/customersController.js';

const router = Router();

router.get('/', getCustomers);

router.post('/', postCustomer);

export default router;
