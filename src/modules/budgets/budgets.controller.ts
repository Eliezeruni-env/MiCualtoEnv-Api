import { Response, NextFunction } from 'express';
import { BudgetsService } from './budgets.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class BudgetsController {
  static async getMonthly(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

      const result = await BudgetsService.getMonthlyBudget(req.user!.id, month, year);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async upsertLine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const line = await BudgetsService.upsertBudgetLine(req.user!.id, req.body);
      return sendSuccess(res, { line }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async categories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await BudgetsService.listCategories(req.user!.id);
      return sendSuccess(res, { categories }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteLine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await BudgetsService.deleteLine(req.user!.id, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await BudgetsService.deleteAll(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
