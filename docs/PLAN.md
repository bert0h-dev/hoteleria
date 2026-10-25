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
- [x] **Fase 2 — Autenticación y usuarios:** esquema principal en Neon (incluye `Hotel`), login, roles y permisos.
  - [x] Backend: esquema, migración `init`, seed, auth JWT + refresh token rotativo, API de usuarios.
  - [x] Frontend: login, rutas protegidas, administración de usuarios, modo oscuro.
- [ ] **Fase 3 — Catálogo:** tipos de habitación, habitaciones, tarifas y estados (libre, ocupada, limpieza, mantenimiento).
  - [x] Backend: configuración de tarifas del hotel (hora 15 %, día 120 %, semana 6× por bloques, mínimo de horas, duración del día, horario de noche), tipos, habitaciones, estados con historial y registro de quién limpió.
  - [ ] Frontend: configuración, tipos de habitación y tablero de habitaciones.
- [ ] **Fase 4 — Huéspedes:** registro y búsqueda.
- [ ] **Fase 5 — Reservas:** disponibilidad, creación, cancelación y prevención de doble reserva.
- [ ] **Fase 6 — Check-in / Check-out.**
- [ ] **Fase 7 — Cobros:** cargos, pagos y folio del huésped.
- [ ] **Fase 8 — Dashboard y reportes:** ocupación, llegadas y salidas del día.
- [ ] **Fase 9 — Limpieza y mantenimiento.**
