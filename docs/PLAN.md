# Plan de desarrollo por fases

Sistema de gestión hotelera. Alcance inicial: **un solo hotel**, con el esquema
preparado para soportar varios hoteles en el futuro (modelo `Hotel` y `hotelId`
en las tablas principales).

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS + TypeScript, Prisma 7, Swagger |
| Base de datos | PostgreSQL en Neon |
| Frontend | React + Vite + TypeScript, React Router, TanStack Query, shadcn/ui + Tailwind, React Hook Form + Zod |
| Autenticación | JWT con roles (administrador, recepción, limpieza) |

## Fases

- [x] **Fase 1 — Estructura:** monorepo con npm workspaces, backend y frontend base, Prisma configurado, endpoint `/api/health`.
- [ ] **Fase 2 — Autenticación y usuarios:** esquema principal en Neon (incluye `Hotel`), login, roles y permisos.
  - [x] Backend: esquema, migración `init`, seed, auth JWT + refresh token rotativo, API de usuarios.
  - [ ] Frontend: login, rutas protegidas, administración de usuarios.
- [ ] **Fase 3 — Catálogo:** tipos de habitación, habitaciones, tarifas y estados (libre, ocupada, limpieza, mantenimiento).
- [ ] **Fase 4 — Huéspedes:** registro y búsqueda.
- [ ] **Fase 5 — Reservas:** disponibilidad, creación, cancelación y prevención de doble reserva.
- [ ] **Fase 6 — Check-in / Check-out.**
- [ ] **Fase 7 — Cobros:** cargos, pagos y folio del huésped.
- [ ] **Fase 8 — Dashboard y reportes:** ocupación, llegadas y salidas del día.
- [ ] **Fase 9 — Limpieza y mantenimiento.**
