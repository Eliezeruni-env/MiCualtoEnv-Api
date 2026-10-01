import { Router } from 'express';
import { SubscriptionsController } from './subscriptions.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', SubscriptionsController.getSummary);
router.get('/', SubscriptionsController.list);
router.post('/', SubscriptionsController.create);
router.delete('/all', SubscriptionsController.deleteAll);
router.post('/bulk-delete', SubscriptionsController.bulkDelete);
router.get('/:id', SubscriptionsController.getById);
router.patch('/:id', SubscriptionsController.update);
router.patch('/:id/toggle-active', SubscriptionsController.toggleActive);
router.delete('/:id', SubscriptionsController.delete);

export default router;

