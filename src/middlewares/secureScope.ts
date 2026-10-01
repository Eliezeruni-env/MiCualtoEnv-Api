import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './auth.js';
import { SecureScope } from '@micualto/shared';
import { config } from '../config/index.js';
import { prisma } from '../config/prisma.js';

export function requireSecureScope(scope: SecureScope) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          data: null,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Se requiere inicio de sesión previo',
          },
        });
      }

      // Nombre de la cookie según el scope
      const cookieName = scope === SecureScope.VAULT ? 'secure_vault_token' : 'secure_ideas_token';
      const headerName = scope === SecureScope.VAULT ? 'x-vault-token' : 'x-ideas-token';

      let token = req.cookies ? req.cookies[cookieName] : undefined;
      if (!token && req.headers[headerName]) {
        token = req.headers[headerName] as string;
      }

      if (!token) {
        return res.status(403).json({
          data: null,
          error: {
            code: 'SECURE_LOCK_REQUIRED',
            message: `Acceso restringido. Este módulo (${scope}) se encuentra bloqueado.`,
            scope,
          },
        });
      }

      // Verificar firma del token JWT
      let decoded: any;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch {
        return res.status(403).json({
          data: null,
          error: {
            code: 'SECURE_LOCK_REQUIRED',
            message: 'La sesión segura ha expirado por inactividad.',
            scope,
          },
        });
      }

      // Validar que el token corresponda al usuario y al scope requerido
      if (decoded.userId !== req.user.id || decoded.scope !== scope) {
        return res.status(403).json({
          data: null,
          error: {
            code: 'SECURE_LOCK_REQUIRED',
            message: 'Token de seguridad inválido para este módulo.',
            scope,
          },
        });
      }

      // Validar en base de datos que no haya sido revocado
      const session = await prisma.secureSession.findFirst({
        where: {
          userId: req.user.id,
          scope,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        return res.status(403).json({
          data: null,
          error: {
            code: 'SECURE_LOCK_REQUIRED',
            message: 'La sesión segura ha sido revocada o ha expirado.',
            scope,
          },
        });
      }

      // Renovar actividad
      await prisma.secureSession.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      });

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
