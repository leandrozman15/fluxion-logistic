import { Router } from 'express';
import { getClients, postClient, putClient, removeClient } from '../controllers/clientsController.js';

const router = Router();

router.get('/', getClients);

router.post('/', postClient);

router.put('/:id', putClient);

router.delete('/:id', removeClient);

export default router;
