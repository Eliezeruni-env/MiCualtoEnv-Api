import { Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class DashboardController {
  static async summary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await DashboardService.getSummary(req.user!.id);
      return sendSuccess(res, summary, 200);
    } catch (err) {
      next(err);
    }
  }
}
