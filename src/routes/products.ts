import { Router } from 'express';
import { getProducts, postProduct, putProduct, removeProduct } from '../controllers/productsController.js';

const router = Router();

router.get('/', getProducts);

router.post('/', postProduct);

router.put('/:id', putProduct);

router.delete('/:id', removeProduct);

export default router;
