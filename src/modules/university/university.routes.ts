import { Router } from 'express';
import { UniversityController } from './university.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

// Summary & semesters
router.get('/summary', UniversityController.getSummary);
router.get('/semesters', UniversityController.getSemesters);

// CRUD
router.get('/', UniversityController.list);
router.post('/', UniversityController.create);
router.get('/:id', UniversityController.getById);
router.patch('/:id', UniversityController.update);
router.delete('/all', UniversityController.deleteAll);
router.delete('/:id', UniversityController.delete);

export default router;
