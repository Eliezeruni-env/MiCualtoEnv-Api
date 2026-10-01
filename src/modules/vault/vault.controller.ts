import { Response, NextFunction } from 'express';
import { VaultService } from './vault.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AuthRequest } from '../../middlewares/auth.js';

export class VaultController {
  static async listDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const folderId = req.query.folderId as string | undefined;
      const documents = await VaultService.listDocuments(req.user!.id, folderId);
      return sendSuccess(res, { documents }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async listFolders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const folders = await VaultService.listFolders(req.user!.id);
      return sendSuccess(res, { folders }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async createDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const document = await VaultService.createDocument(req.user!.id, req.body);
      return sendSuccess(res, { document }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async createFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const folder = await VaultService.createFolder(req.user!.id, req.body);
      return sendSuccess(res, { folder }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async checklist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const checklist = await VaultService.getChecklistStatus(req.user!.id);
      return sendSuccess(res, { checklist }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async expiring(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expiring = await VaultService.getExpiringSoon(req.user!.id);
      return sendSuccess(res, { expiring }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async uploadFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { originalName, mimeType, base64Content } = req.body;
      const file = await VaultService.addFileToDocument(req.user!.id, id, {
        originalName,
        mimeType,
        base64Content,
      });
      return sendSuccess(res, { file }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      const file = await VaultService.getFile(req.user!.id, fileId);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
      res.send(file.buffer);
    } catch (err) {
      next(err);
    }
  }

  static async deleteDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await VaultService.deleteDocument(req.user!.id, id);
      return sendSuccess(res, { deleted: true, document: result }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAllDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await VaultService.deleteAllDocuments(req.user!.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

