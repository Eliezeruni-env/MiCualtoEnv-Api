import { Router } from 'express';
import { IdeasController } from './ideas.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireSecureScope } from '../../middlewares/secureScope.js';
import { validateBody } from '../../middlewares/validate.js';
import { SecureScope, CreateIdeaSchema, UpdateIdeaCanvasSchema } from '@micualto/shared';

const router = Router();

// Protegido con auth de sesión principal + Secure Gate IDEAS
router.use(requireAuth);
router.use(requireSecureScope(SecureScope.IDEAS));

router.get('/', IdeasController.list);
router.delete('/all', IdeasController.deleteAll);
router.get('/:id', IdeasController.getById);
router.delete('/:id', IdeasController.delete);
router.post('/', validateBody(CreateIdeaSchema), IdeasController.create);
router.put('/:id/canvas', validateBody(UpdateIdeaCanvasSchema), IdeasController.updateCanvas);
router.patch('/:id/stage', IdeasController.updateStage);
router.post('/:id/convert-project', IdeasController.convertToProject);

export default router;
