import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { InventoryService } from './inventory.service.js';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  inventoryFilterSchema,
} from '@micualto/shared';

export class InventoryController {
  static async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { category, condition, isConsumable, search } = req.query;

      const filter: any = {};
      if (category) filter.category = category as any;
      if (condition) filter.condition = condition as any;
      if (isConsumable !== undefined) filter.isConsumable = isConsumable === 'true' || isConsumable === '1';
      if (search) filter.search = String(search);

      const parsed = inventoryFilterSchema.parse(filter);
      const items = await InventoryService.list(userId, parsed);

      res.status(200).json({ success: true, data: items });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const item = await InventoryService.getById(userId, id);
      res.status(200).json({ success: true, data: item });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async getSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const summary = await InventoryService.getSummary(userId);
      res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const parsed = createInventoryItemSchema.parse(req.body);

      const item = await InventoryService.create(userId, parsed);
      res.status(201).json({ success: true, data: item });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const parsed = updateInventoryItemSchema.parse(req.body);

      const item = await InventoryService.update(userId, id, parsed);
      res.status(200).json({ success: true, data: item });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await InventoryService.delete(userId, id);
      res.status(200).json({ success: true, message: 'Artículo de inventario eliminado' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await InventoryService.deleteAll(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
