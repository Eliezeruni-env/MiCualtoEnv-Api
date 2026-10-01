import { Response, NextFunction } from 'express';
import { TransportService } from './transport.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class TransportController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const logs = await TransportService.list(req.user!.id);
      return sendSuccess(res, { logs }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const log = await TransportService.create(req.user!.id, req.body);
      return sendSuccess(res, { log }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async stats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await TransportService.getStats(req.user!.id);
      return sendSuccess(res, { stats }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await TransportService.delete(req.user!.id, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await TransportService.deleteAll(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
