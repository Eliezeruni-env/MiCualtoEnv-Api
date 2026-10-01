import { Router } from 'express';
import { SecureController } from './secure.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { SecureUnlockSchema, UpdateUsernameSchema } from '@micualto/shared';

const router = Router();

router.use(requireAuth);

router.post('/unlock', validateBody(SecureUnlockSchema), SecureController.unlock);
router.get('/status', SecureController.status);
router.post('/lock', SecureController.lock);
router.post('/username', validateBody(UpdateUsernameSchema), SecureController.updateUsername);

export default router;
