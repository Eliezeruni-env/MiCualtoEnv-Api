import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { AppAccountsService } from './app-accounts.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  createAppCredentialSchema,
  updateAppCredentialSchema,
  appCredentialFilterSchema,
} from '@micualto/shared';

export class AppAccountsController {
  static async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { linkedEmail, category, search } = req.query;

      const filter: any = {};
      if (linkedEmail) filter.linkedEmail = String(linkedEmail);
      if (category) filter.category = String(category);
      if (search) filter.search = String(search);

      const parsed = appCredentialFilterSchema.parse(filter);
      const list = await AppAccountsService.list(userId, parsed);

      return sendSuccess(res, list, 200);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const item = await AppAccountsService.getById(userId, id);
      return sendSuccess(res, item, 200);
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  static async getEmails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const emails = await AppAccountsService.getEmails(userId);
      return sendSuccess(res, emails, 200);
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  static async getSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const summary = await AppAccountsService.getSummary(userId);
      return sendSuccess(res, summary, 200);
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const parsed = createAppCredentialSchema.parse(req.body);

      const item = await AppAccountsService.create(userId, parsed);
      return sendSuccess(res, item, 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const parsed = updateAppCredentialSchema.parse(req.body);

      const item = await AppAccountsService.update(userId, id, parsed);
      return sendSuccess(res, item, 200);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await AppAccountsService.delete(userId, id);
      return sendSuccess(res, { success: true, message: 'Credencial eliminada correctamente' }, 200);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  static async deleteAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await AppAccountsService.deleteAll(userId);
      return sendSuccess(res, { success: true, count: result.count, message: `Se eliminaron ${result.count} cuentas exitosamente` }, 200);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  static async bulkDelete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return sendError(res, 'Debes proporcionar una lista de identificadores para eliminar', 400);
      }
      const result = await AppAccountsService.bulkDelete(userId, ids);
      return sendSuccess(res, { success: true, count: result.count, message: `Se eliminaron ${result.count} cuentas exitosamente` }, 200);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

