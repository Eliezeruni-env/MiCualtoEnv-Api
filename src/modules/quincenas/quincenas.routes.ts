import { Router } from 'express';
import { QuincenasController } from './quincenas.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

// Quincena Plans
router.get('/', QuincenasController.list);
router.post('/', QuincenasController.create);
router.post('/generate-month', QuincenasController.generateMonth);
router.get('/:id', QuincenasController.getById);
router.patch('/:id', QuincenasController.update);
router.delete('/all', QuincenasController.deleteAll);
router.delete('/:id', QuincenasController.delete);

// Allocations within a Quincena
router.post('/:id/allocations', QuincenasController.addAllocation);
router.post('/:id/cuadre', QuincenasController.applyCuadre);
router.post('/:id/import-commitments', QuincenasController.importCommitments);
router.patch('/allocations/:allocationId', QuincenasController.updateAllocation);
router.patch('/allocations/:allocationId/toggle-paid', QuincenasController.togglePaid);
router.delete('/allocations/:allocationId', QuincenasController.deleteAllocation);

export default router;
