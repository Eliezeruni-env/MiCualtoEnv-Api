import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', InventoryController.getSummary);
router.get('/', InventoryController.list);
router.post('/', InventoryController.create);
router.get('/:id', InventoryController.getById);
router.patch('/:id', InventoryController.update);
router.delete('/all', InventoryController.deleteAll);
router.delete('/:id', InventoryController.delete);

export default router;
