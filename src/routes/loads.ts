import { Router } from 'express';
import { getLoads, postLoad, putLoad, removeLoad } from '../controllers/loadsController.js';

const router = Router();

router.get('/', getLoads);

router.post('/', postLoad);

router.put('/:id', putLoad);

router.delete('/:id', removeLoad);

export default router;
