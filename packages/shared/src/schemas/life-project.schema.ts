import { z } from 'zod';
import { LifeArea } from '../enums/index.js';

export const CreateLifeProjectSchema = z.object({
  title: z.string().min(2, 'El título del proyecto de vida es requerido'),
  area: z.nativeEnum(LifeArea).default(LifeArea.FINANCIAL_FREEDOM),
  vision: z.string().optional(),
  targetYear: z.number().int().min(2024).max(2100).optional(),
  goalId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

export type CreateLifeProjectInput = z.infer<typeof CreateLifeProjectSchema>;

export const CreateLifeMilestoneSchema = z.object({
  title: z.string().min(2, 'El título del hito es requerido'),
  targetDate: z.string().or(z.date()).optional(),
  notes: z.string().optional(),
});

export type CreateLifeMilestoneInput = z.infer<typeof CreateLifeMilestoneSchema>;
