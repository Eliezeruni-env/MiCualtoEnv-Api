import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Rutas modulares
import authRoutes from './modules/auth/auth.routes.js';
import accountsRoutes from './modules/accounts/accounts.routes.js';
import transactionsRoutes from './modules/transactions/transactions.routes.js';
import transportRoutes from './modules/transport/transport.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import secureRoutes from './modules/secure/secure.routes.js';
import vaultRoutes from './modules/vault/vault.routes.js';
import ideasRoutes from './modules/ideas/ideas.routes.js';
import lifeProjectsRoutes from './modules/life-projects/life-projects.routes.js';
import budgetsRoutes from './modules/budgets/budgets.routes.js';
import goalsRoutes from './modules/goals/goals.routes.js';
import { debtsRouter } from './modules/debts/debts.routes.js';
import { emailSyncRouter } from './modules/email-sync/email-sync.routes.js';
import quincenasRoutes from './modules/quincenas/quincenas.routes.js';
import universityRoutes from './modules/university/university.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes.js';
import appAccountsRoutes from './modules/app-accounts/app-accounts.routes.js';
import { systemRoutes } from './modules/system/system.routes.js';
import { categoriesRoutes } from './modules/categories/categories.routes.js';
import { swaggerRouter } from './swagger.js';

export const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes locales o sin origen (ej: curl / mobile)
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // modo dev flexible
    }
  },
  credentials: true,
  exposedHeaders: ['x-new-token', 'authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.cookieSecret));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger Documentation
app.use('/api', swaggerRouter);

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/secure', secureRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/life-projects', lifeProjectsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/debts', debtsRouter);
app.use('/api/email-sync', emailSyncRouter);
app.use('/api/quincenas', quincenasRoutes);
app.use('/api/university', universityRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/app-accounts', appAccountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/system', systemRoutes);

// Error handler global
app.use(errorHandler);
