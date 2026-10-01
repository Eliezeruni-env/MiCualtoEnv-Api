import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';

export const swaggerRouter = Router();

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'MiCualtoEnv API — Sistema Financiero Personal Dominicano',
    version: '1.0.0',
    description: 'API REST segura y documentada para MiCualtoEnv (Finanzas, Ledger Atómico, Bóveda de Documentos, IdeaLab y Proyectos de Vida).',
    contact: {
      name: 'Pelier',
      email: 'pelier@fintrack.do',
    },
  },
  servers: [
    {
      url: 'http://localhost:4005/api',
      description: 'Servidor Local de Desarrollo',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      VaultCookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'secure_vault_token',
      },
      IdeasCookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'secure_ideas_token',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Verificación de estado del servidor',
        responses: {
          200: { description: 'Servidor activo' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Inicio de sesión principal',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'pelier@fintrack.do' },
                  password: { type: 'string', example: 'admin123' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Token de acceso y datos del usuario' },
          401: { description: 'Credenciales inválidas' },
        },
      },
    },
    '/secure/unlock': {
      post: {
        summary: 'Desbloqueo Step-Up para Bóveda o IdeaLab (Username + Email + Contraseña)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scope: { type: 'string', enum: ['VAULT', 'IDEAS'], example: 'VAULT' },
                  username: { type: 'string', example: 'pelier' },
                  email: { type: 'string', example: 'pelier@fintrack.do' },
                  password: { type: 'string', example: 'admin123' },
                  totp: { type: 'string', example: '123456' },
                },
                required: ['scope', 'username', 'email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Módulo desbloqueado exitosamente. Setea cookie segura.' },
          401: { description: 'Las credenciales no coinciden con el usuario autenticado' },
          429: { description: 'Demasiados intentos fallidos (bloqueo progresivo anti-brute force)' },
        },
      },
    },
    '/dashboard/summary': {
      get: {
        summary: 'Resumen consolidado de KPIs financieros, donas de rubro y balance',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Datos y métricas del dashboard' },
        },
      },
    },
    '/transport': {
      get: {
        summary: 'Listado de traslados en transporte (Uber, DiDi, Metro, Gasolina)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Historial de movilidad' },
        },
      },
      post: {
        summary: 'Registrar nuevo viaje de transporte',
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Viaje registrado con Ledger atómico' },
        },
      },
    },
    '/transport/stats': {
      get: {
        summary: 'Estadísticas y comparativa de costos de movilidad en RD',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Total gastado, viajes y promedios por plataforma' },
        },
      },
    },
    '/vault/documents': {
      get: {
        summary: 'Listado de documentos protegidos de la Bóveda (Requiere Secure Scope VAULT)',
        security: [{ BearerAuth: [] }, { VaultCookieAuth: [] }],
        responses: {
          200: { description: 'Documentos custodiados' },
          403: { description: 'SECURE_LOCK_REQUIRED: Bóveda bloqueada' },
        },
      },
    },
    '/ideas': {
      get: {
        summary: 'Listado de ideas de negocio y canvas (Requiere Secure Scope IDEAS)',
        security: [{ BearerAuth: [] }, { IdeasCookieAuth: [] }],
        responses: {
          200: { description: 'Ideas registradas' },
          403: { description: 'SECURE_LOCK_REQUIRED: IdeaLab bloqueado' },
        },
      },
    },
    '/life-projects': {
      get: {
        summary: 'Proyectos de vida e hitos personales/financieros',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Proyectos de vida' },
        },
      },
    },
  },
};

swaggerRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
