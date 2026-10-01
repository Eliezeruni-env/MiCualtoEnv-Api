import { Response, NextFunction } from 'express';
import { TransactionsService } from './transactions.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class TransactionsController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const accountId = req.query.accountId as string | undefined;
      const transactions = await TransactionsService.list(req.user!.id, { limit, accountId });
      return sendSuccess(res, { transactions }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transaction = await TransactionsService.create(req.user!.id, req.body);
      return sendSuccess(res, { transaction }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await TransactionsService.delete(req.user!.id, req.params.id);
      return sendSuccess(res, { deleted: result }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await TransactionsService.deleteAll(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
