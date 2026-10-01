import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { SecureScope, SecureUnlockInput, UpdateUsernameInput } from '@micualto/shared';

// Duración de la sesión segura: 10 minutos de inactividad
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export class SecureService {
  /**
   * Desbloquea un módulo protegido mediante step-up auth
   */
  static async unlock(
    userId: string,
    input: SecureUnlockInput,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const now = new Date();

    // 1. Control de fuerza bruta: verificar intentos fallidos recientes
    const windowStart = new Date(now.getTime() - LOCKOUT_WINDOW_MS);
    const recentFails = await prisma.securityEvent.count({
      where: {
        userId,
        success: false,
        eventType: 'UNLOCK_FAILED',
        createdAt: { gte: windowStart },
      },
    });

    if (recentFails >= MAX_ATTEMPTS) {
      await prisma.securityEvent.create({
        data: {
          userId,
          scope: input.scope,
          eventType: 'RATE_LIMITED',
          success: false,
          reason: 'Bloqueo temporal por exceso de intentos fallidos',
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        },
      });

      throw new AppError(
        'Demasiados intentos fallidos. Por seguridad, el acceso ha sido bloqueado temporalmente por 15 minutos.',
        429
      );
    }

    // 2. Buscar al usuario actual autenticado
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.unauthorized('Usuario no encontrado');
    }

    // Comparación estricta y segura
    const inputEmailNorm = input.email.trim().toLowerCase();
    const inputUsernameNorm = input.username.trim().toLowerCase();
    const userEmailNorm = user.email.toLowerCase();
    const userUsernameNorm = (user.username || '').toLowerCase();

    const isEmailMatch = inputEmailNorm === userEmailNorm;
    const isUsernameMatch = userUsernameNorm ? inputUsernameNorm === userUsernameNorm : true;

    let isPasswordValid = false;
    try {
      isPasswordValid = await argon2.verify(user.passwordHash, input.password);
    } catch {
      isPasswordValid = user.passwordHash === input.password;
    }

    // Si no coincide o la contraseña es inválida, responder con mensaje genérico
    if (!isEmailMatch || !isUsernameMatch || !isPasswordValid) {
      await prisma.securityEvent.create({
        data: {
          userId,
          scope: input.scope,
          eventType: 'UNLOCK_FAILED',
          success: false,
          reason: 'Credenciales de desbloqueo no coinciden con la sesión activa',
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        },
      });

      throw AppError.unauthorized('Las credenciales proporcionadas no coinciden con la cuenta activa.');
    }

    // Si el usuario no tenía username registrado, se lo guardamos
    if (!user.username) {
      await prisma.user.update({
        where: { id: user.id },
        data: { username: inputUsernameNorm },
      });
    }

    // 3. Generar token de sesión segura con scope específico
    const expiresAt = new Date(now.getTime() + INACTIVITY_TIMEOUT_MS);
    const tokenPayload = {
      userId: user.id,
      scope: input.scope,
      exp: Math.floor(expiresAt.getTime() / 1000),
    };

    const secureToken = jwt.sign(tokenPayload, config.jwtSecret);
    const tokenHash = crypto.createHash('sha256').update(secureToken).digest('hex');

    // Revocar sesiones previas activas de ese scope para este usuario
    await prisma.secureSession.updateMany({
      where: { userId: user.id, scope: input.scope, revokedAt: null },
      data: { revokedAt: now },
    });

    // Registrar nueva sesión segura
    await prisma.secureSession.create({
      data: {
        userId: user.id,
        scope: input.scope,
        tokenHash,
        expiresAt,
        lastActivityAt: now,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    // Registrar evento de auditoría exitoso
    await prisma.securityEvent.create({
      data: {
        userId: user.id,
        scope: input.scope,
        eventType: 'UNLOCK_SUCCESS',
        success: true,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return {
      scope: input.scope,
      secureToken,
      expiresAt,
      inactivityTimeoutSeconds: Math.floor(INACTIVITY_TIMEOUT_MS / 1000),
    };
  }

  /**
   * Obtiene el estado actual de desbloqueo de Bóveda e Ideas
   */
  static async getStatus(userId: string) {
    const now = new Date();
    const activeSessions = await prisma.secureSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });

    const isVaultUnlocked = activeSessions.some((s) => s.scope === SecureScope.VAULT);
    const isIdeasUnlocked = activeSessions.some((s) => s.scope === SecureScope.IDEAS);

    const vaultSession = activeSessions.find((s) => s.scope === SecureScope.VAULT);
    const ideasSession = activeSessions.find((s) => s.scope === SecureScope.IDEAS);

    return {
      vault: {
        isUnlocked: isVaultUnlocked,
        expiresAt: vaultSession?.expiresAt || null,
        remainingSeconds: vaultSession
          ? Math.max(0, Math.floor((vaultSession.expiresAt.getTime() - now.getTime()) / 1000))
          : 0,
      },
      ideas: {
        isUnlocked: isIdeasUnlocked,
        expiresAt: ideasSession?.expiresAt || null,
        remainingSeconds: ideasSession
          ? Math.max(0, Math.floor((ideasSession.expiresAt.getTime() - now.getTime()) / 1000))
          : 0,
      },
    };
  }

  /**
   * Bloquea manualmente un scope específico o ambos
   */
  static async lock(userId: string, scope?: SecureScope) {
    const now = new Date();
    await prisma.secureSession.updateMany({
      where: {
        userId,
        ...(scope ? { scope } : {}),
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    await prisma.securityEvent.create({
      data: {
        userId,
        scope,
        eventType: 'MANUAL_LOCK',
        success: true,
      },
    });

    return { success: true, message: `Módulo ${scope || 'completo'} bloqueado exitosamente` };
  }

  /**
   * Permite definir o actualizar el username
   */
  static async updateUsername(userId: string, input: UpdateUsernameInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('Usuario no encontrado');

    const isValid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!isValid) {
      throw AppError.badRequest('La contraseña actual es incorrecta');
    }

    const usernameNorm = input.username.trim().toLowerCase();

    // Verificar si ya existe otro usuario con ese username
    const existing = await prisma.user.findFirst({
      where: { username: usernameNorm, NOT: { id: userId } },
    });

    if (existing) {
      throw AppError.badRequest('Este nombre de usuario ya está en uso');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { username: usernameNorm },
      select: { id: true, username: true, email: true, name: true },
    });

    return updated;
  }
}
