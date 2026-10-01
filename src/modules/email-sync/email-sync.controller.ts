import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.js';
import { EmailSyncService } from './email-sync.service.js';
import { sendSuccess } from '../../utils/response.js';

export class EmailSyncController {
  static async parseText(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rawText = req.body.rawEmailText || req.body.text;
      if (!rawText) {
        return res.status(400).json({ message: 'El texto del correo es requerido' });
      }
      const parsed = await EmailSyncService.parseEmailTextAsync(
        rawText,
        req.body.subject,
        undefined,
        undefined,
        req.user?.id
      );
      return sendSuccess(res, parsed, 200);
    } catch (err) {
      next(err);
    }
  }

  static async approveTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await EmailSyncService.approveParsedTransaction(req.user!.id, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  static async approveBatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { accountId, items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Se requiere una lista de transacciones' });
      }
      const result = await EmailSyncService.approveBatch(req.user!.id, { accountId, items });
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  static async scanInbox(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userEmail, appPassword, daysBack, scanLimit, startDate, endDate } = req.body;
      const result = await EmailSyncService.scanGmailInbox(req.user!.id, {
        userEmail,
        appPassword,
        daysBack: daysBack ? parseInt(daysBack) : 45,
        scanLimit: scanLimit ? parseInt(scanLimit) : 150,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const config = await EmailSyncService.getGmailSyncConfig(req.user!.id);
      return sendSuccess(res, config, 200);
    } catch (err) {
      next(err);
    }
  }

  static async scanAccountsAndSubscriptions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userEmail, appPassword, daysBack, scanLimit } = req.body;
      const result = await EmailSyncService.scanAccountsAndSubscriptions(req.user!.id, {
        userEmail,
        appPassword,
        daysBack: daysBack ? parseInt(daysBack) : 90,
        scanLimit: scanLimit ? parseInt(scanLimit) : 300,
      });
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async importDetectedAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { accounts } = req.body;
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ message: 'Se requiere una lista de cuentas para importar' });
      }
      const result = await EmailSyncService.importDetectedAccounts(req.user!.id, accounts);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  static async importDetectedSubscriptions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { subscriptions } = req.body;
      if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return res.status(400).json({ message: 'Se requiere una lista de suscripciones para importar' });
      }
      const result = await EmailSyncService.importDetectedSubscriptions(req.user!.id, subscriptions);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }
}

