import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/auth.js';
import { LoginSchema, RegisterSchema } from '@micualto/shared';

const router = Router();

router.post('/login', validateBody(LoginSchema), AuthController.login);
router.post('/register', validateBody(RegisterSchema), AuthController.register);
router.get('/me', requireAuth, AuthController.me);
router.get('/logout-audit', requireAuth, AuthController.logoutAudit);
router.post('/logout', requireAuth, AuthController.logout);

export default router;
