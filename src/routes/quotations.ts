import { Router } from 'express';
import { getQuotations, postQuotation, putQuotation, removeQuotation } from '../controllers/quotationsController.js';

const router = Router();

router.get('/', getQuotations);

router.post('/', postQuotation);

router.put('/:id', putQuotation);

router.delete('/:id', removeQuotation);

export default router;
