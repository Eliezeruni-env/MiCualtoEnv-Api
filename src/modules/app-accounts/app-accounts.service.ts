import { prisma } from '../../config/prisma.js';
import {
  CreateAppCredentialInput,
  UpdateAppCredentialInput,
  AppCredentialFilterInput,
  AppCredentialSummary,
} from '@micualto/shared';

export class AppAccountsService {
  static async list(userId: string, filter?: AppCredentialFilterInput) {
    const where: any = { userId };

    if (filter?.linkedEmail) {
      where.linkedEmail = filter.linkedEmail;
    }

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { appName: { contains: q, mode: 'insensitive' } },
        { linkedEmail: { contains: q, mode: 'insensitive' } },
        { usernameOrHandle: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.appCredential.findMany({
      where,
      orderBy: [{ linkedEmail: 'asc' }, { appName: 'asc' }],
    });
  }

  static async getById(userId: string, id: string) {
    const cred = await prisma.appCredential.findFirst({
      where: { id, userId },
    });

    if (!cred) {
      throw new Error('Credencial no encontrada');
    }

    return cred;
  }

  static async getEmails(userId: string): Promise<string[]> {
    const list = await prisma.appCredential.findMany({
      where: { userId },
      distinct: ['linkedEmail'],
      select: { linkedEmail: true },
      orderBy: { linkedEmail: 'asc' },
    });

    return list.map((l) => l.linkedEmail);
  }

  static async getSummary(userId: string): Promise<AppCredentialSummary> {
    const items = await prisma.appCredential.findMany({
      where: { userId },
      select: {
        linkedEmail: true,
        hasTwoFactor: true,
      },
    });

    let with2FaCount = 0;
    const byEmail: Record<string, number> = {};

    for (const it of items) {
      if (it.hasTwoFactor) with2FaCount++;
      byEmail[it.linkedEmail] = (byEmail[it.linkedEmail] || 0) + 1;
    }

    return {
      totalAccounts: items.length,
      emailsCount: Object.keys(byEmail).length,
      with2FaCount,
      byEmail,
    };
  }

  static async create(userId: string, input: CreateAppCredentialInput) {
    return prisma.appCredential.create({
      data: {
        userId,
        appName: input.appName.trim(),
        linkedEmail: input.linkedEmail.trim().toLowerCase(),
        usernameOrHandle: input.usernameOrHandle?.trim() || null,
        password: input.password,
        websiteUrl: input.websiteUrl?.trim() || null,
        hasTwoFactor: Boolean(input.hasTwoFactor),
        category: input.category || 'GENERAL',
        notes: input.notes?.trim() || null,
      },
    });
  }

  static async update(userId: string, id: string, input: UpdateAppCredentialInput) {
    const existing = await prisma.appCredential.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Credencial no encontrada');
    }

    const data: any = {};
    if (input.appName !== undefined) data.appName = input.appName.trim();
    if (input.linkedEmail !== undefined) data.linkedEmail = input.linkedEmail.trim().toLowerCase();
    if (input.usernameOrHandle !== undefined) data.usernameOrHandle = input.usernameOrHandle?.trim() || null;
    if (input.password !== undefined) data.password = input.password;
    if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl?.trim() || null;
    if (input.hasTwoFactor !== undefined) data.hasTwoFactor = Boolean(input.hasTwoFactor);
    if (input.category !== undefined) data.category = input.category;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    return prisma.appCredential.update({
      where: { id },
      data,
    });
  }

  static async delete(userId: string, id: string) {
    const existing = await prisma.appCredential.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Credencial no encontrada');
    }

    await prisma.appCredential.delete({
      where: { id },
    });

    return { success: true };
  }

  static async deleteAll(userId: string) {
    const result = await prisma.appCredential.deleteMany({
      where: { userId },
    });

    return { success: true, count: result.count };
  }

  static async bulkDelete(userId: string, ids: string[]) {
    if (!ids || ids.length === 0) {
      return { success: true, count: 0 };
    }

    const result = await prisma.appCredential.deleteMany({
      where: {
        userId,
        id: { in: ids },
      },
    });

    return { success: true, count: result.count };
  }
}

