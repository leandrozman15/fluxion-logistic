import { Router } from 'express';
import { getTenants, postTenant, putTenant, removeTenant } from '../controllers/tenantsController.js';

const router = Router();

router.get('/', getTenants);

router.post('/', postTenant);

router.put('/:id', putTenant);

router.delete('/:id', removeTenant);

export default router;
