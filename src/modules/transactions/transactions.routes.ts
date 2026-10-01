import { Router } from 'express';
import { TransactionsController } from './transactions.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { CreateTransactionSchema } from '@micualto/shared';

const router = Router();

router.use(requireAuth);

router.get('/', TransactionsController.list);
router.post('/', validateBody(CreateTransactionSchema), TransactionsController.create);
router.delete('/all', TransactionsController.deleteAll);
router.delete('/:id', TransactionsController.delete);

export default router;
