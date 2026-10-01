import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { UniversityService } from './university.service.js';
import {
  createUniversityExpenseSchema,
  updateUniversityExpenseSchema,
  universityExpenseFilterSchema,
} from '@micualto/shared';

export class UniversityController {
  static async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { category, isWaste, termSemester, startDate, endDate, search } = req.query;

      const filter: any = {};
      if (category) filter.category = category as any;
      if (isWaste !== undefined) filter.isWaste = isWaste === 'true' || isWaste === '1';
      if (termSemester) filter.termSemester = String(termSemester);
      if (startDate) filter.startDate = String(startDate);
      if (endDate) filter.endDate = String(endDate);
      if (search) filter.search = String(search);

      const parsedFilter = universityExpenseFilterSchema.parse(filter);
      const expenses = await UniversityService.list(userId, parsedFilter);

      res.status(200).json({ success: true, data: expenses });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const expense = await UniversityService.getById(userId, id);
      res.status(200).json({ success: true, data: expense });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async getSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { termSemester, startDate, endDate } = req.query;

      const summary = await UniversityService.getSummary(userId, {
        termSemester: termSemester ? String(termSemester) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });

      res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getSemesters(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semesters = await UniversityService.getSemesters(userId);
      res.status(200).json({ success: true, data: semesters });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const parsed = createUniversityExpenseSchema.parse(req.body);

      const expense = await UniversityService.create(userId, parsed);
      res.status(201).json({ success: true, data: expense });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const parsed = updateUniversityExpenseSchema.parse(req.body);

      const expense = await UniversityService.update(userId, id, parsed);
      res.status(200).json({ success: true, data: expense });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await UniversityService.delete(userId, id);
      res.status(200).json({ success: true, message: 'Gasto universitario eliminado' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await UniversityService.deleteAll(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
