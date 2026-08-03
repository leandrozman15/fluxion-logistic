import { Router } from 'express';
import { getTrucks, postTruck, putTruck, removeTruck } from '../controllers/trucksController.js';

const router = Router();

router.get('/', getTrucks);

router.post('/', postTruck);

router.put('/:id', putTruck);

router.delete('/:id', removeTruck);

export default router;
