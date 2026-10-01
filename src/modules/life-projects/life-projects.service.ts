import { prisma } from '../../config/prisma.js';
import { CreateLifeProjectInput, CreateLifeMilestoneInput } from '@micualto/shared';
import { AppError } from '../../utils/AppError.js';

export class LifeProjectsService {
  static async list(userId: string) {
    return prisma.lifeProject.findMany({
      where: { userId },
      include: {
        milestones: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { targetYear: 'asc' },
    });
  }

  static async create(userId: string, input: CreateLifeProjectInput) {
    return prisma.lifeProject.create({
      data: {
        userId,
        title: input.title,
        area: input.area,
        vision: input.vision,
        targetYear: input.targetYear,
        goalId: input.goalId,
        projectId: input.projectId,
      },
      include: { milestones: true },
    });
  }

  static async addMilestone(userId: string, lifeProjectId: string, input: CreateLifeMilestoneInput) {
    const project = await prisma.lifeProject.findFirst({
      where: { id: lifeProjectId, userId },
    });
    if (!project) throw AppError.notFound('Proyecto de vida no encontrado');

    const milestone = await prisma.lifeMilestone.create({
      data: {
        lifeProjectId,
        title: input.title,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        notes: input.notes,
      },
    });

    await this.recalculateProgress(lifeProjectId);
    return milestone;
  }

  static async toggleMilestone(userId: string, milestoneId: string) {
    const milestone = await prisma.lifeMilestone.findFirst({
      where: { id: milestoneId },
      include: { lifeProject: true },
    });

    if (!milestone || milestone.lifeProject.userId !== userId) {
      throw AppError.notFound('Hito no encontrado');
    }

    const updated = await prisma.lifeMilestone.update({
      where: { id: milestoneId },
      data: {
        isCompleted: !milestone.isCompleted,
        completedAt: !milestone.isCompleted ? new Date() : null,
      },
    });

    await this.recalculateProgress(milestone.lifeProjectId);
    return updated;
  }

  private static async recalculateProgress(lifeProjectId: string) {
    const milestones = await prisma.lifeMilestone.findMany({
      where: { lifeProjectId },
    });

    if (milestones.length === 0) return;

    const completed = milestones.filter((m) => m.isCompleted).length;
    const progressPct = Math.round((completed / milestones.length) * 100);

    await prisma.lifeProject.update({
      where: { id: lifeProjectId },
      data: { progressPct },
    });
  }

  static async delete(userId: string, id: string) {
    const project = await prisma.lifeProject.findFirst({ where: { id, userId } });
    if (!project) throw AppError.notFound('Proyecto no encontrado');
    await prisma.lifeMilestone.deleteMany({ where: { lifeProjectId: id } });
    await prisma.lifeProject.delete({ where: { id } });
    return { success: true };
  }

  static async deleteMilestone(userId: string, milestoneId: string) {
    const milestone = await prisma.lifeMilestone.findFirst({
      where: { id: milestoneId, lifeProject: { userId } }
    });
    if (!milestone) throw AppError.notFound('Hito no encontrado');
    const lifeProjectId = milestone.lifeProjectId;
    await prisma.lifeMilestone.delete({ where: { id: milestoneId } });
    await this.recalculateProgress(lifeProjectId);
    return { success: true };
  }

  static async deleteAll(userId: string) {
    await prisma.lifeMilestone.deleteMany({ where: { lifeProject: { userId } } });
    await prisma.lifeProject.deleteMany({ where: { userId } });
    return { success: true, message: 'Todos los proyectos de vida han sido eliminados' };
  }
}
