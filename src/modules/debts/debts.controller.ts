import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { DebtsService } from './debts.service.js';
import { createDebtSchema, recordDebtPaymentSchema, createLoanSchema, recordLoanCollectionSchema } from '@micualto/shared';

export class DebtsController {
  static async getSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await DebtsService.getSummary(req.user!.id);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }

  static async listDebts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const debts = await DebtsService.listDebts(req.user!.id);
      res.json({ debts });
    } catch (err) {
      next(err);
    }
  }

  static async createDebt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const input = createDebtSchema.parse(req.body);
      const debt = await DebtsService.createDebt(req.user!.id, input);
      res.status(201).json(debt);
    } catch (err) {
      next(err);
    }
  }

  static async recordDebtPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const input = recordDebtPaymentSchema.parse(req.body);
      const result = await DebtsService.recordDebtPayment(req.user!.id, req.params.id, input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async listLoans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const loans = await DebtsService.listLoans(req.user!.id);
      res.json({ loans });
    } catch (err) {
      next(err);
    }
  }

  static async createLoan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const input = createLoanSchema.parse(req.body);
      const loan = await DebtsService.createLoan(req.user!.id, input);
      res.status(201).json(loan);
    } catch (err) {
      next(err);
    }
  }

  static async recordLoanCollection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const input = recordLoanCollectionSchema.parse(req.body);
      const result = await DebtsService.recordLoanCollection(req.user!.id, req.params.id, input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteDebt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DebtsService.deleteDebt(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAllDebts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DebtsService.deleteAllDebts(req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async bulkDeleteDebts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: { message: 'Lista de IDs inválida' } });
      }
      const result = await DebtsService.bulkDeleteDebts(req.user!.id, ids);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteLoan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DebtsService.deleteLoan(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAllLoans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DebtsService.deleteAllLoans(req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async bulkDeleteLoans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: { message: 'Lista de IDs inválida' } });
      }
      const result = await DebtsService.bulkDeleteLoans(req.user!.id, ids);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}


