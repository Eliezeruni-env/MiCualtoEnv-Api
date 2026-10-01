import { Router } from 'express';
import { AccountsController } from './accounts.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { CreateAccountSchema } from '@micualto/shared';

const router = Router();

router.use(requireAuth);

router.get('/', AccountsController.list);
router.get('/banks', AccountsController.listBanks);
router.delete('/all', AccountsController.resetAll);
router.get('/:id', AccountsController.getById);
router.delete('/:id', AccountsController.delete);
router.post('/', validateBody(CreateAccountSchema), AccountsController.create);

export default router;
