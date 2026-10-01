import { Router } from 'express';
import { GoalsController } from './goals.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', GoalsController.list);
router.post('/', GoalsController.create);
router.post('/:id/contribute', GoalsController.contribute);
router.delete('/all', GoalsController.deleteAll);
router.delete('/:id', GoalsController.delete);

export default router;
