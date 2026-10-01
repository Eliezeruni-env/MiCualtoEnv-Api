import { Router } from 'express';
import { DebtsController } from './debts.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

export const debtsRouter = Router();

debtsRouter.use(requireAuth);

debtsRouter.get('/summary', DebtsController.getSummary);

// Deudas
debtsRouter.delete('/all', DebtsController.deleteAllDebts);
debtsRouter.post('/bulk-delete', DebtsController.bulkDeleteDebts);
debtsRouter.get('/', DebtsController.listDebts);
debtsRouter.post('/', DebtsController.createDebt);
debtsRouter.delete('/:id', DebtsController.deleteDebt);
debtsRouter.post('/:id/payments', DebtsController.recordDebtPayment);

// Préstamos (Me deben)
debtsRouter.delete('/loans/all', DebtsController.deleteAllLoans);
debtsRouter.post('/loans/bulk-delete', DebtsController.bulkDeleteLoans);
debtsRouter.get('/loans', DebtsController.listLoans);
debtsRouter.post('/loans', DebtsController.createLoan);
debtsRouter.delete('/loans/:id', DebtsController.deleteLoan);
debtsRouter.post('/loans/:id/collections', DebtsController.recordLoanCollection);
