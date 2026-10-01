import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', DashboardController.summary);

export default router;
