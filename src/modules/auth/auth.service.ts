import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { LoginInput, RegisterInput } from '@micualto/shared';

export class AuthService {
  static async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (!user || !user.isActive) {
      throw AppError.unauthorized('Credenciales inválidas');
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await argon2.verify(user.passwordHash, input.password);
    } catch {
      // Fallback para hashes simples o errores de verificación
      isPasswordValid = user.passwordHash === input.password;
    }

    if (!isPasswordValid) {
      throw AppError.unauthorized('Credenciales inválidas');
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '365d' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      config.jwtRefreshSecret,
      { expiresIn: '365d' }
    );

    // Guardar refresh token en db
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt
      }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        baseCurrency: user.baseCurrency
      },
      accessToken,
      refreshToken
    };
  }

  static async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (existing) {
      throw AppError.badRequest('El correo ya está registrado');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash
      }
    });

    return this.login({ email: input.email, password: input.password });
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        baseCurrency: true,
        createdAt: true
      }
    });

    if (!user) {
      throw AppError.notFound('Usuario no encontrado');
    }

    return user;
  }

  static async getLogoutAudit(userId: string) {
    const now = new Date();

    // 1. Transacciones pendientes de confirmación o sin categoría
    const [pendingReviewCount, unconfirmedTxs] = await Promise.all([
      prisma.transaction.count({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { status: 'PENDING_REVIEW' },
            { categoryId: null }
          ]
        }
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { status: 'PENDING_REVIEW' },
            { categoryId: null }
          ]
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          notes: true,
          occurredAt: true,
          status: true
        },
        orderBy: { occurredAt: 'desc' },
        take: 3
      })
    ]);

    // 2. Deudas vencidas pendientes de pago
    const allOverdueDebts = await prisma.debt.findMany({
      where: {
        userId,
        dueDate: { lte: now }
      },
      select: {
        id: true,
        creditorName: true,
        remainingAmount: true,
        currency: true,
        dueDate: true
      },
      take: 10
    });
    const overdueDebts = allOverdueDebts.filter((d: { remainingAmount: any }) => Number(d.remainingAmount) > 0).slice(0, 3);

    // 3. Asignaciones de quincena vencidas sin pagar
    const overdueAllocations = await prisma.quincenaAllocation.findMany({
      where: {
        quincenaPlan: { userId },
        isPaid: false,
        dueDate: { lte: now }
      },
      select: {
        id: true,
        name: true,
        expectedAmount: true,
        dueDate: true
      },
      take: 3
    });

    const pendingCount = pendingReviewCount + overdueDebts.length + overdueAllocations.length;

    return {
      hasPending: pendingCount > 0,
      pendingCount,
      pendingTransactions: {
        count: pendingReviewCount,
        preview: unconfirmedTxs
      },
      overdueDebts: {
        count: overdueDebts.length,
        preview: overdueDebts
      },
      overdueAllocations: {
        count: overdueAllocations.length,
        preview: overdueAllocations
      }
    };
  }
}
