import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);

      // Settear refresh token en cookie httpOnly
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return sendSuccess(res, {
        user: result.user,
        accessToken: result.accessToken
      }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.register(req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getMe(req.user!.id);
      return sendSuccess(res, { user }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie('refresh_token');
      return sendSuccess(res, { message: 'Sesión cerrada exitosamente' }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async logoutAudit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const audit = await AuthService.getLogoutAudit(req.user!.id);
      return sendSuccess(res, audit, 200);
    } catch (err) {
      next(err);
    }
  }
}
