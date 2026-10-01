import { prisma } from '../../config/prisma.js';
import { CreateIdeaInput, UpdateIdeaCanvasInput, IdeaStage } from '@micualto/shared';
import { AppError } from '../../utils/AppError.js';
import Decimal from 'decimal.js';

export class IdeasService {
  static async list(userId: string) {
    return prisma.idea.findMany({
      where: { userId },
      include: {
        partners: { include: { person: true } },
        project: true,
        canvas: true,
        financialModel: true,
      },
      orderBy: [{ iceScore: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  static async getById(userId: string, ideaId: string) {
    const idea = await prisma.idea.findFirst({
      where: { id: ideaId, userId },
      include: {
        partners: { include: { person: true } },
        canvas: true,
        swot: true,
        financialModel: true,
        stageHistory: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { priority: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        project: true,
      },
    });

    if (!idea) throw AppError.notFound('Idea no encontrada');
    return idea;
  }

  static async create(userId: string, input: CreateIdeaInput) {
    // Calcular ICE score automáticamente
    const ice = new Decimal(input.impactScore + input.confidenceScore + input.easeScore)
      .dividedBy(3)
      .toDecimalPlaces(2);

    return prisma.idea.create({
      data: {
        userId,
        title: input.title,
        oneLinePitch: input.oneLinePitch,
        description: input.description,
        type: input.type,
        stage: input.stage,
        category: input.category,
        priority: input.priority,
        isConfidential: input.isConfidential,
        impactScore: input.impactScore,
        confidenceScore: input.confidenceScore,
        easeScore: input.easeScore,
        iceScore: ice.toNumber(),
      },
      include: {
        canvas: true,
        partners: true,
      },
    });
  }

  static async updateCanvas(userId: string, ideaId: string, input: UpdateIdeaCanvasInput) {
    const idea = await prisma.idea.findFirst({ where: { id: ideaId, userId } });
    if (!idea) throw AppError.notFound('Idea no encontrada');

    return prisma.ideaCanvas.upsert({
      where: { ideaId },
      create: {
        ideaId,
        ...input,
      },
      update: {
        ...input,
      },
    });
  }

  static async updateStage(userId: string, ideaId: string, toStage: IdeaStage, reason?: string) {
    const idea = await prisma.idea.findFirst({ where: { id: ideaId, userId } });
    if (!idea) throw AppError.notFound('Idea no encontrada');

    const fromStage = idea.stage;

    return prisma.$transaction(async (tx) => {
      // Registrar cambio en historial
      await tx.ideaStageHistory.create({
        data: {
          ideaId,
          fromStage,
          toStage,
          reason,
        },
      });

      return tx.idea.update({
        where: { id: ideaId },
        data: { stage: toStage },
      });
    });
  }

  static async convertToProject(userId: string, ideaId: string) {
    const idea = await prisma.idea.findFirst({
      where: { id: ideaId, userId },
      include: { project: true },
    });

    if (!idea) throw AppError.notFound('Idea no encontrada');
    if (idea.project) throw AppError.badRequest('Esta idea ya está vinculada a un proyecto de FinTrack');

    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          userId,
          name: idea.title,
          description: idea.oneLinePitch || idea.description,
          status: 'ACTIVE',
          color: '#1e40af',
        },
      });

      await tx.idea.update({
        where: { id: ideaId },
        data: {
          projectId: project.id,
          stage: IdeaStage.IN_DEVELOPMENT,
        },
      });

      return project;
    });
  }

  static async delete(userId: string, id: string) {
    const idea = await prisma.idea.findFirst({ where: { id, userId } });
    if (!idea) throw AppError.notFound('Idea no encontrada');
    await prisma.idea.delete({ where: { id } });
    return { success: true };
  }

  static async deleteAll(userId: string) {
    await prisma.idea.deleteMany({ where: { userId } });
    return { success: true, message: 'Todas las ideas han sido eliminadas' };
  }
}
