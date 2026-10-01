import { Response, NextFunction } from 'express';
import { AccountsService } from './accounts.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class AccountsController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const accounts = await AccountsService.listByUser(req.user!.id);
      return sendSuccess(res, { accounts }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const account = await AccountsService.getById(req.user!.id, req.params.id);
      return sendSuccess(res, { account }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const account = await AccountsService.create(req.user!.id, req.body);
      return sendSuccess(res, { account }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async listBanks(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const banks = await AccountsService.listBanks();
      return sendSuccess(res, { banks }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await AccountsService.delete(req.user!.id, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async resetAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await AccountsService.resetAll(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
