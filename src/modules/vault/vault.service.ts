import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { CreateVaultDocumentInput, CreateVaultFolderInput } from '@micualto/shared';
import { AppError } from '../../utils/AppError.js';

const VAULT_STORAGE_DIR = path.resolve(process.cwd(), 'uploads/vault');
if (!fs.existsSync(VAULT_STORAGE_DIR)) {
  fs.mkdirSync(VAULT_STORAGE_DIR, { recursive: true });
}

export class VaultService {
  static async listDocuments(userId: string, folderId?: string) {
    return prisma.vaultDocument.findMany({
      where: {
        userId,
        isDeleted: false,
        ...(folderId ? { folderId } : {}),
      },
      include: {
        folder: true,
        person: true,
        files: { orderBy: { version: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async listFolders(userId: string) {
    return prisma.vaultFolder.findMany({
      where: { userId },
      include: {
        _count: { select: { documents: { where: { isDeleted: false } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createDocument(userId: string, input: CreateVaultDocumentInput) {
    const document = await prisma.vaultDocument.create({
      data: {
        userId,
        title: input.title,
        folderId: input.folderId,
        category: input.category,
        subType: input.subType,
        issuer: input.issuer,
        documentNumber: input.documentNumber,
        issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        status: input.status,
        notes: input.notes,
        isFavorite: input.isFavorite,
        personId: input.personId,
        projectId: input.projectId,
        debtId: input.debtId,
        loanId: input.loanId,
        ideaId: input.ideaId,
      },
      include: { folder: true, files: true },
    });

    // Si viene archivo adjunto en la creación, guardarlo de inmediato
    if (input.file && input.file.base64Content) {
      await this.addFileToDocument(userId, document.id, input.file);
      // Retornar documento actualizado con el archivo adjunto
      return prisma.vaultDocument.findUnique({
        where: { id: document.id },
        include: { folder: true, files: { orderBy: { version: 'desc' } } },
      });
    }

    return document;
  }

  static async addFileToDocument(
    userId: string,
    documentId: string,
    fileData: { originalName: string; mimeType: string; base64Content: string }
  ) {
    const document = await prisma.vaultDocument.findFirst({
      where: { id: documentId, userId },
      include: { files: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!document) throw AppError.notFound('Documento de la bóveda no encontrado');

    // Limpiar prefijo data URL si existe (ej: "data:image/png;base64,...")
    const cleanBase64 = fileData.base64Content.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Guardar en disco seguro
    const fileId = crypto.randomUUID();
    const safeStorageKey = `${fileId}-${Date.now()}`;
    const filePath = path.join(VAULT_STORAGE_DIR, safeStorageKey);
    fs.writeFileSync(filePath, buffer);

    const nextVersion = (document.files[0]?.version || 0) + 1;

    return prisma.vaultFile.create({
      data: {
        id: fileId,
        documentId,
        version: nextVersion,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        sizeBytes: buffer.length,
        sha256,
        storageKey: safeStorageKey,
      },
    });
  }

  static async getFile(userId: string, fileId: string) {
    const fileRecord = await prisma.vaultFile.findUnique({
      where: { id: fileId },
      include: { document: true },
    });

    if (!fileRecord || fileRecord.document.userId !== userId || fileRecord.document.isDeleted) {
      throw AppError.notFound('Archivo no encontrado o acceso denegado');
    }

    const filePath = path.join(VAULT_STORAGE_DIR, fileRecord.storageKey);
    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('El archivo físico no se encuentra en el almacenamiento');
    }

    const buffer = fs.readFileSync(filePath);
    return {
      buffer,
      mimeType: fileRecord.mimeType,
      originalName: fileRecord.originalName,
    };
  }

  static async createFolder(userId: string, input: CreateVaultFolderInput) {
    return prisma.vaultFolder.create({
      data: {
        userId,
        name: input.name,
        parentId: input.parentId,
        color: input.color,
        icon: input.icon,
      },
    });
  }

  static async getChecklistStatus(userId: string) {
    // Documentos esenciales dominicanos
    const essentialCategories = [
      { name: 'Cédula de Identidad', category: 'IDENTITY' },
      { name: 'Acta de Nacimiento', category: 'IDENTITY' },
      { name: 'Pasaporte Vigente', category: 'IDENTITY' },
      { name: 'Licencia de Conducir', category: 'IDENTITY' },
      { name: 'Contrato de Alquiler o Título de Propiedad', category: 'PROPERTY_VEHICLES' },
      { name: 'Seguro Médico / Póliza', category: 'HEALTH' },
    ];

    const userDocs = await prisma.vaultDocument.findMany({
      where: { userId, isDeleted: false },
      select: { category: true, title: true, subType: true },
    });

    const checklist = essentialCategories.map((item) => {
      const hasItem = userDocs.some(
        (doc: { category: string; title: string; subType: string | null }) =>
          doc.category === item.category &&
          (doc.title.toLowerCase().includes(item.name.toLowerCase()) ||
            (doc.subType && doc.subType.toLowerCase().includes(item.name.toLowerCase())))
      );
      return {
        name: item.name,
        category: item.category,
        isUploaded: hasItem,
      };
    });

    const uploadedCount = checklist.filter((i) => i.isUploaded).length;
    const progressPct = Math.round((uploadedCount / checklist.length) * 100);

    return {
      total: checklist.length,
      uploadedCount,
      progressPct,
      items: checklist,
    };
  }

  static async getExpiringSoon(userId: string) {
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 3600 * 1000);

    return prisma.vaultDocument.findMany({
      where: {
        userId,
        isDeleted: false,
        expiryDate: {
          not: null,
          lte: ninetyDaysFromNow,
        },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  static async deleteDocument(userId: string, id: string) {
    const doc = await prisma.vaultDocument.findFirst({
      where: { id, userId },
    });
    if (!doc) throw AppError.notFound('Documento no encontrado');

    return prisma.vaultDocument.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  static async deleteAllDocuments(userId: string) {
    await prisma.vaultAccessLog.deleteMany({ where: { userId } });
    await prisma.vaultTag.deleteMany({ where: { userId } });
    await prisma.vaultDocument.deleteMany({ where: { userId } });
    await prisma.vaultFolder.deleteMany({ where: { userId } });
    return { success: true, message: 'Todos los documentos y carpetas han sido eliminados' };
  }
}
