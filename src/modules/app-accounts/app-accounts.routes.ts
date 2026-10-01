import { Router } from 'express';
import { AppAccountsController } from './app-accounts.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', AppAccountsController.getSummary);
router.get('/emails', AppAccountsController.getEmails);
router.get('/', AppAccountsController.list);
router.post('/', AppAccountsController.create);
router.delete('/all', AppAccountsController.deleteAll);
router.post('/bulk-delete', AppAccountsController.bulkDelete);
router.get('/:id', AppAccountsController.getById);
router.patch('/:id', AppAccountsController.update);
router.delete('/:id', AppAccountsController.delete);

export default router;

