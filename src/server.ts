import { app } from './app.js';
import { config } from './config/index.js';
import { prisma } from './config/prisma.js';

async function bootstrap() {
  try {
    // Probar conexión a Prisma
    await prisma.$connect();
    console.log('✅ Base de datos conectada correctamente (PostgreSQL)');

    app.listen(config.port, () => {
      console.log(`🚀 Servidor MiCualtoEnv API corriendo en http://localhost:${config.port}`);
      console.log(`📦 Modo: ${config.env}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

bootstrap();
