import { Response, NextFunction } from 'express';
import { IdeasService } from './ideas.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';
import { IdeaStage } from '@micualto/shared';

export class IdeasController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ideas = await IdeasService.list(req.user!.id);
      return sendSuccess(res, { ideas }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idea = await IdeasService.getById(req.user!.id, req.params.id);
      return sendSuccess(res, { idea }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idea = await IdeasService.create(req.user!.id, req.body);
      return sendSuccess(res, { idea }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateCanvas(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const canvas = await IdeasService.updateCanvas(req.user!.id, req.params.id, req.body);
      return sendSuccess(res, { canvas }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async updateStage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { stage, reason } = req.body;
      const idea = await IdeasService.updateStage(req.user!.id, req.params.id, stage as IdeaStage, reason);
      return sendSuccess(res, { idea }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async convertToProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await IdeasService.convertToProject(req.user!.id, req.params.id);
      return sendSuccess(res, { project }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await IdeasService.delete(req.user!.id, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await IdeasService.deleteAll(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
