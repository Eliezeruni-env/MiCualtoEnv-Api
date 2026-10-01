import { Response, NextFunction } from 'express';
import { GoalsService } from './goals.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class GoalsController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const goals = await GoalsService.list(req.user!.id);
      return sendSuccess(res, { goals }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const goal = await GoalsService.create(req.user!.id, req.body);
      return sendSuccess(res, { goal }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async contribute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await GoalsService.contribute(req.user!.id, id, req.body);
      return sendSuccess(res, { goal: result }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await GoalsService.delete(req.user!.id, id);
      return sendSuccess(res, { deleted: true }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await GoalsService.deleteAll(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
