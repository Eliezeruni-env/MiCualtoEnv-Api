import { Router } from 'express';
import { EmailSyncController } from './email-sync.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

export const emailSyncRouter = Router();

emailSyncRouter.use(requireAuth);

emailSyncRouter.post('/parse', EmailSyncController.parseText);
emailSyncRouter.post('/parse-text', EmailSyncController.parseText);
emailSyncRouter.post('/scan', EmailSyncController.scanInbox);
emailSyncRouter.post('/approve', EmailSyncController.approveTransaction);
emailSyncRouter.post('/approve-batch', EmailSyncController.approveBatch);
emailSyncRouter.get('/config', EmailSyncController.getConfig);
emailSyncRouter.post('/scan-accounts-and-subscriptions', EmailSyncController.scanAccountsAndSubscriptions);
emailSyncRouter.post('/import-detected-accounts', EmailSyncController.importDetectedAccounts);
emailSyncRouter.post('/import-detected-subscriptions', EmailSyncController.importDetectedSubscriptions);

