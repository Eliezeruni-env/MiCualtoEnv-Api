import { Router } from 'express';
import { SystemController } from './system.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

export const systemRoutes = Router();

systemRoutes.use(requireAuth);

systemRoutes.post('/reset-all', SystemController.resetAllData);
