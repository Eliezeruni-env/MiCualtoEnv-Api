import { Router } from 'express';
import { CategoriesController } from './categories.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', CategoriesController.list);
router.get('/:id', CategoriesController.getById);
router.post('/', CategoriesController.create);
router.put('/:id', CategoriesController.update);
router.delete('/:id', CategoriesController.delete);

export { router as categoriesRoutes };
