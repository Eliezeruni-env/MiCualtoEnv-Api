import { Response, NextFunction } from 'express';
import { MetroCardsService } from './metro-cards.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class MetroCardsController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await MetroCardsService.list(req.user!.id);
      return sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const card = await MetroCardsService.create(req.user!.id, req.body);
      return sendSuccess(res, { card }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async recharge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await MetroCardsService.recharge(req.user!.id, req.params.id, req.body);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async registerTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cardId = (req.params.id && req.params.id !== 'direct' && req.params.id !== 'trip') ? req.params.id : req.body.cardId;
      const result = await MetroCardsService.registerTrip(req.user!.id, cardId, req.body);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const card = await MetroCardsService.update(req.user!.id, req.params.id, req.body);
      return sendSuccess(res, { card }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await MetroCardsService.delete(req.user!.id, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async listRecharges(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recharges = await MetroCardsService.listRecharges(req.user!.id, req.params.id);
      return sendSuccess(res, { recharges }, 200);
    } catch (err) {
      next(err);
    }
  }
}
