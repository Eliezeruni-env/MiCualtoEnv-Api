import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde la raíz
// Cargar variables de entorno
dotenv.config();
dotenv.config(); // fallback local

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'fallback_jwt_secret_micualto_env_2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_micualto_env_2026',
  cookieSecret: process.env.COOKIE_SECRET || 'fallback_cookie_secret_2026',
  defaultUsdRate: parseFloat(process.env.DEFAULT_USD_RATE || '60.25'),
  corsOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    process.env.WEB_URL || 'http://localhost:5175'
  ]
};
