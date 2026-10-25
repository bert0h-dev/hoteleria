# Hotelería

Sistema de gestión hotelera. Monorepo con **npm workspaces**:

```
backend/   API en NestJS + Prisma (PostgreSQL en Neon)
frontend/  Aplicación web en React + Vite
docs/      Documentación y plan de desarrollo
```

## Requisitos

- Node.js 24 o superior
- npm 11 o superior
- Una base de datos PostgreSQL en [Neon](https://neon.tech)

## Puesta en marcha

```bash
# 1. Instalar dependencias (también genera el cliente de Prisma)
npm install

# 2. Variables de entorno
cp backend/.env.example backend/.env     # poner las URL de Neon
cp frontend/.env.example frontend/.env

# 3. Aplicar migraciones y cargar datos iniciales (hotel + usuario ADMIN)
npm run prisma:deploy -w backend
npm run prisma:seed -w backend

# 4. Levantar backend y frontend
npm run dev
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5180 |
| API | http://localhost:3000/api |
| Documentación (Swagger) | http://localhost:3000/api/docs |
| Estado | http://localhost:3000/api/health |

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Backend y frontend en modo desarrollo |
| `npm run dev:api` / `npm run dev:web` | Solo uno de los dos |
| `npm run build` | Compila ambos proyectos |
| `npm run lint` | Linter (oxlint) en ambos proyectos |
| `npm run format` | Formatea el código con Prettier |
| `npm run prisma:migrate -w backend` | Crea y aplica migraciones |
| `npm run prisma:seed -w backend` | Crea el hotel y el ADMIN inicial (datos de `SEED_*` en `.env`) |
| `npm run prisma:studio -w backend` | Abre Prisma Studio |
| `npm test` | Pruebas unitarias y e2e del backend (las e2e usan la base de `DATABASE_URL`) |

## Plan de desarrollo

Consulta [docs/PLAN.md](docs/PLAN.md).
