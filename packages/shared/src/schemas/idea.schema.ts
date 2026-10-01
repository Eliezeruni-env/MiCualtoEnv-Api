import { z } from 'zod';
import { IdeaType, IdeaStage } from '../enums/index.js';

export const CreateIdeaSchema = z.object({
  title: z.string().min(2, 'El título de la idea es requerido'),
  oneLinePitch: z.string().optional(),
  description: z.string().optional(),
  type: z.nativeEnum(IdeaType).default(IdeaType.PERSONAL),
  stage: z.nativeEnum(IdeaStage).default(IdeaStage.SEED),
  category: z.string().optional(),
  priority: z.number().int().min(1).max(5).default(3),
  isConfidential: z.boolean().default(false),
  impactScore: z.number().int().min(1).max(10).default(5),
  confidenceScore: z.number().int().min(1).max(10).default(5),
  easeScore: z.number().int().min(1).max(10).default(5),
});

export type CreateIdeaInput = z.infer<typeof CreateIdeaSchema>;

export const UpdateIdeaCanvasSchema = z.object({
  problem: z.string().optional(),
  solution: z.string().optional(),
  valueProposition: z.string().optional(),
  customerSegments: z.string().optional(),
  channels: z.string().optional(),
  revenueStreams: z.string().optional(),
  costStructure: z.string().optional(),
  keyMetrics: z.string().optional(),
  unfairAdvantage: z.string().optional(),
});

export type UpdateIdeaCanvasInput = z.infer<typeof UpdateIdeaCanvasSchema>;

export const FinancialModelSchema = z.object({
  initialInvestment: z.string().or(z.number()).transform(v => String(v)),
  monthlyFixedCosts: z.string().or(z.number()).transform(v => String(v)),
  variableCostPerUnit: z.string().or(z.number()).transform(v => String(v)),
  targetPricePerUnit: z.string().or(z.number()).transform(v => String(v)),
  estimatedUnitsMonth: z.number().int().min(0),
});

export type FinancialModelInput = z.infer<typeof FinancialModelSchema>;
