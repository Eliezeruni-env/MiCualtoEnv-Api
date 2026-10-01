# 🚀 MiCualtoEnv - Backend (API)

API REST para el sistema de finanzas personales dominicano **MiCualtoEnv**, construida con **Node.js**, **Express**, **TypeScript**, **Prisma ORM** y **PostgreSQL**.

---

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Base de Datos**: PostgreSQL
- **ORM**: Prisma v6
- **Autenticación**: JWT (Access & Refresh tokens) + Argon2
- **Validación**: Zod

---

## 📦 Instalación y Configuración

1. Clona el repositorio:
   ```bash
   git clone https://github.com/Eliezeruni-env/MiCualtoEnv-Api.git
   cd MiCualtoEnv-Api
   ```

2. Instala las dependencias:
   ```bash
   pnpm install
   # o
   npm install
   ```

3. Crea y configura tu archivo de entorno `.env`:
   ```bash
   cp .env.example .env
   ```

4. Levanta la base de datos PostgreSQL con Docker:
   ```bash
   pnpm db:up
   # o
   docker compose up -d
   ```

5. Genera el cliente de Prisma y aplica las migraciones:
   ```bash
   pnpm db:push
   # o pnpm db:migrate
   ```

6. (Opcional) Carga los datos de prueba (semillas):
   ```bash
   pnpm db:seed
   ```

---

## 💻 Ejecución

### Modo Desarrollo
```bash
pnpm dev
# o npm run dev
```
El servidor iniciará en [http://localhost:4000](http://localhost:4000).

### Compilación y Producción
```bash
pnpm build
pnpm start
```

---

## 🗄️ Comandos de Base de Datos (Prisma)

- `pnpm db:up`: Inicia el contenedor de PostgreSQL
- `pnpm db:down`: Detiene el contenedor de PostgreSQL
- `pnpm db:push`: Sincroniza el esquema de Prisma con la BD
- `pnpm db:migrate`: Aplica migraciones pendientes
- `pnpm db:generate`: Regenera los tipos de Prisma Client
- `pnpm db:seed`: Ejecuta los seeders de prueba
- `pnpm db:studio`: Abre la interfaz visual de Prisma Studio

---

## 📁 Estructura del Proyecto

```
MiCualtoEnv-Api/
├── prisma/
│   ├── schema.prisma   # Esquema de base de datos
│   ├── seed.ts         # Datos de prueba iniciales
│   └── clean.ts        # Limpieza de base de datos
├── packages/
│   └── shared/         # Tipos y esquemas compartidos
├── src/
│   ├── config/         # Configuración (Prisma, variables, etc.)
│   ├── middlewares/    # Auth, validación, seguridad
│   ├── modules/        # Módulos de dominio (auth, accounts, transactions, etc.)
│   ├── app.ts          # Configuración de Express
│   └── server.ts       # Inicio del servidor
├── docker-compose.yml  # Servicio de PostgreSQL
├── package.json
└── tsconfig.json
```

---

## 📄 Licencia

MIT
