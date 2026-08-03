import { Router } from 'express';
import { getDrivers, postDriver, putDriver, removeDriver } from '../controllers/driversController.js';

const router = Router();

router.get('/', getDrivers);

router.post('/', postDriver);

router.put('/:id', putDriver);

router.delete('/:id', removeDriver);

export default router;
