import { Router } from 'express';
import { LifeProjectsController } from './life-projects.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { CreateLifeProjectSchema, CreateLifeMilestoneSchema } from '@micualto/shared';

const router = Router();

router.use(requireAuth);

router.get('/', LifeProjectsController.list);
router.delete('/all', LifeProjectsController.deleteAll);
router.delete('/milestones/:milestoneId', LifeProjectsController.deleteMilestone);
router.delete('/:id', LifeProjectsController.delete);
router.post('/', validateBody(CreateLifeProjectSchema), LifeProjectsController.create);
router.post('/:id/milestones', validateBody(CreateLifeMilestoneSchema), LifeProjectsController.addMilestone);
router.patch('/milestones/:milestoneId/toggle', LifeProjectsController.toggleMilestone);

export default router;
