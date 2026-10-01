import { Router } from 'express';
import { BudgetsController } from './budgets.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', BudgetsController.getMonthly);
router.post('/line', BudgetsController.upsertLine);
router.delete('/line/:id', BudgetsController.deleteLine);
router.delete('/all', BudgetsController.deleteAll);
router.get('/categories', BudgetsController.categories);

export default router;
