import { Response, NextFunction } from 'express';
import { CategoriesService } from './categories.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class CategoriesController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as string | undefined;
      const categories = await CategoriesService.list(req.user!.id, type);
      return sendSuccess(res, { categories }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const category = await CategoriesService.getById(req.user!.id, req.params.id);
      return sendSuccess(res, { category }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const category = await CategoriesService.create(req.user!.id, req.body);
      return sendSuccess(res, { category }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const category = await CategoriesService.update(req.user!.id, req.params.id, req.body);
      return sendSuccess(res, { category }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await CategoriesService.delete(req.user!.id, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
