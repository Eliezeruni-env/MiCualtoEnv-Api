import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { SubscriptionsService } from './subscriptions.service.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  subscriptionFilterSchema,
} from '@micualto/shared';

export class SubscriptionsController {
  static async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { isActive, currency, search } = req.query;

      const filter: any = {};
      if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === '1';
      if (currency) filter.currency = currency as any;
      if (search) filter.search = String(search);

      const parsed = subscriptionFilterSchema.parse(filter);
      const list = await SubscriptionsService.list(userId, parsed);

      res.status(200).json({ success: true, data: list });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const sub = await SubscriptionsService.getById(userId, id);
      res.status(200).json({ success: true, data: sub });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async getSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const summary = await SubscriptionsService.getSummary(userId);
      res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const parsed = createSubscriptionSchema.parse(req.body);

      const sub = await SubscriptionsService.create(userId, parsed);
      res.status(201).json({ success: true, data: sub });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const parsed = updateSubscriptionSchema.parse(req.body);

      const sub = await SubscriptionsService.update(userId, id, parsed);
      res.status(200).json({ success: true, data: sub });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async toggleActive(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const sub = await SubscriptionsService.toggleActive(userId, id);
      res.status(200).json({ success: true, data: sub });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await SubscriptionsService.delete(userId, id);
      res.status(200).json({ success: true, message: 'Suscripción eliminada' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await SubscriptionsService.deleteAll(userId);
      res.status(200).json({ success: true, count: result.count, message: `Se eliminaron ${result.count} suscripciones exitosamente` });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async bulkDelete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Debes proporcionar una lista de identificadores' });
      }
      const result = await SubscriptionsService.bulkDelete(userId, ids);
      res.status(200).json({ success: true, count: result.count, message: `Se eliminaron ${result.count} suscripciones exitosamente` });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

