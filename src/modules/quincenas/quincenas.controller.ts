import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { QuincenasService } from './quincenas.service.js';
import {
  createQuincenaPlanSchema,
  updateQuincenaPlanSchema,
  createAllocationSchema,
  updateAllocationSchema,
  generateMonthQuincenasSchema,
} from '@micualto/shared';

export class QuincenasController {
  static async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { year, month } = req.query;

      const plans = await QuincenasService.list(
        userId,
        year ? Number(year) : undefined,
        month ? Number(month) : undefined
      );

      res.status(200).json({ success: true, data: plans });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const plan = await QuincenasService.getById(userId, id);
      res.status(200).json({ success: true, data: plan });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const parsed = createQuincenaPlanSchema.parse(req.body);

      const plan = await QuincenasService.create(userId, parsed);
      res.status(201).json({ success: true, data: plan });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async generateMonth(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const parsed = generateMonthQuincenasSchema.parse(req.body);

      const plans = await QuincenasService.generateMonthQuincenas(userId, parsed);
      res.status(200).json({ success: true, data: plans });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const parsed = updateQuincenaPlanSchema.parse(req.body);

      const plan = await QuincenasService.update(userId, id, parsed);
      res.status(200).json({ success: true, data: plan });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await QuincenasService.delete(userId, id);
      res.status(200).json({ success: true, message: 'Plan de quincena eliminado.' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await QuincenasService.deleteAll(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async addAllocation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const parsed = createAllocationSchema.parse(req.body);

      const allocation = await QuincenasService.addAllocation(userId, id, parsed);
      res.status(201).json({ success: true, data: allocation });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async updateAllocation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { allocationId } = req.params;
      const parsed = updateAllocationSchema.parse(req.body);

      const allocation = await QuincenasService.updateAllocation(userId, allocationId, parsed);
      res.status(200).json({ success: true, data: allocation });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async togglePaid(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { allocationId } = req.params;

      const allocation = await QuincenasService.togglePaid(userId, allocationId);
      res.status(200).json({ success: true, data: allocation });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteAllocation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { allocationId } = req.params;

      await QuincenasService.deleteAllocation(userId, allocationId);
      res.status(200).json({ success: true, message: 'Asignación eliminada.' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async importCommitments(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await QuincenasService.importPendingCommitments(userId, id);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async applyCuadre(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const plan = await QuincenasService.applyCuadre(userId, id, req.body);
      res.status(200).json({ success: true, data: plan });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
