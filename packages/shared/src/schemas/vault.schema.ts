import { z } from 'zod';
import { DocumentCategory, DocumentStatus } from '../enums/index.js';

export const CreateVaultDocumentSchema = z.object({
  title: z.string().min(2, 'El título del documento es requerido'),
  folderId: z.string().uuid().optional(),
  category: z.nativeEnum(DocumentCategory).default(DocumentCategory.OTHER),
  subType: z.string().optional(),
  issuer: z.string().optional(),
  documentNumber: z.string().optional(),
  issueDate: z.string().or(z.date()).optional(),
  expiryDate: z.string().or(z.date()).optional(),
  status: z.nativeEnum(DocumentStatus).default(DocumentStatus.ACTIVE),
  notes: z.string().optional(),
  isFavorite: z.boolean().optional().default(false),
  personId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  debtId: z.string().uuid().optional(),
  loanId: z.string().uuid().optional(),
  ideaId: z.string().uuid().optional(),
  file: z.object({
    originalName: z.string(),
    mimeType: z.string(),
    base64Content: z.string(),
  }).optional(),
});

export type CreateVaultDocumentInput = z.infer<typeof CreateVaultDocumentSchema>;

export const CreateVaultFolderSchema = z.object({
  name: z.string().min(1, 'El nombre de la carpeta es requerido'),
  parentId: z.string().uuid().optional(),
  color: z.string().optional().default('#1e40af'),
  icon: z.string().optional().default('folder'),
});

export type CreateVaultFolderInput = z.infer<typeof CreateVaultFolderSchema>;
