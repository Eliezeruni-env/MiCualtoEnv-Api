import { Response, NextFunction } from 'express';
import { SecureService } from './secure.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';
import { SecureScope } from '@micualto/shared';

export class SecureController {
  static async unlock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await SecureService.unlock(req.user!.id, req.body, {
        ipAddress,
        userAgent,
      });

      // Settear cookie específica por scope
      const cookieName =
        result.scope === SecureScope.VAULT ? 'secure_vault_token' : 'secure_ideas_token';

      res.cookie(cookieName, result.secureToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: result.inactivityTimeoutSeconds * 1000,
      });

      return sendSuccess(
        res,
        {
          scope: result.scope,
          expiresAt: result.expiresAt,
          inactivityTimeoutSeconds: result.inactivityTimeoutSeconds,
          token: result.secureToken,
        },
        200
      );
    } catch (err) {
      next(err);
    }
  }

  static async status(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = await SecureService.getStatus(req.user!.id);
      return sendSuccess(res, status, 200);
    } catch (err) {
      next(err);
    }
  }

  static async lock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.body.scope as SecureScope | undefined;
      const result = await SecureService.lock(req.user!.id, scope);

      if (!scope || scope === SecureScope.VAULT) {
        res.clearCookie('secure_vault_token');
      }
      if (!scope || scope === SecureScope.IDEAS) {
        res.clearCookie('secure_ideas_token');
      }

      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async updateUsername(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await SecureService.updateUsername(req.user!.id, req.body);
      return sendSuccess(res, { user: updated }, 200);
    } catch (err) {
      next(err);
    }
  }
}
