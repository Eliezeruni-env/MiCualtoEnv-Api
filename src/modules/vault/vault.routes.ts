import { Router } from 'express';
import { VaultController } from './vault.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireSecureScope } from '../../middlewares/secureScope.js';
import { validateBody } from '../../middlewares/validate.js';
import { SecureScope, CreateVaultDocumentSchema, CreateVaultFolderSchema } from '@micualto/shared';

const router = Router();

// Protegido con auth de sesión principal + Secure Gate VAULT
router.use(requireAuth);
router.use(requireSecureScope(SecureScope.VAULT));

router.get('/documents', VaultController.listDocuments);
router.post('/documents', validateBody(CreateVaultDocumentSchema), VaultController.createDocument);
router.get('/folders', VaultController.listFolders);
router.post('/folders', validateBody(CreateVaultFolderSchema), VaultController.createFolder);
router.get('/checklist', VaultController.checklist);
router.get('/expiring', VaultController.expiring);
router.post('/documents/:id/files', VaultController.uploadFile);
router.get('/files/:fileId', VaultController.getFile);
router.delete('/documents/all', VaultController.deleteAllDocuments);
router.delete('/documents/:id', VaultController.deleteDocument);

export default router;
