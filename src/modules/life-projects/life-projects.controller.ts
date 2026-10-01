import { Response, NextFunction } from 'express';
import { LifeProjectsService } from './life-projects.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class LifeProjectsController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const projects = await LifeProjectsService.list(req.user!.id);
      return sendSuccess(res, { projects }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await LifeProjectsService.create(req.user!.id, req.body);
      return sendSuccess(res, { project }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async addMilestone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const milestone = await LifeProjectsService.addMilestone(req.user!.id, req.params.id, req.body);
      return sendSuccess(res, { milestone }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async toggleMilestone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const milestone = await LifeProjectsService.toggleMilestone(req.user!.id, req.params.milestoneId);
      return sendSuccess(res, { milestone }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await LifeProjectsService.delete(req.user!.id, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteMilestone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await LifeProjectsService.deleteMilestone(req.user!.id, req.params.milestoneId);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await LifeProjectsService.deleteAll(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
