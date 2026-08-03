import { Router } from 'express';
import { getUsers, postUser, putUser, removeUser } from '../controllers/usersController.js';

const router = Router();

router.get('/', getUsers);

router.post('/', postUser);

router.put('/:id', putUser);

router.delete('/:id', removeUser);

export default router;
