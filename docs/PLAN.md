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
- [x] **Fase 3 — Catálogo:** tipos de habitación, habitaciones, tarifas y estados (libre, ocupada, limpieza, mantenimiento).
  - [x] Backend: configuración de tarifas del hotel (hora 15 %, día 120 %, semana 6× por bloques, mínimo de horas, duración del día, horario de noche), tipos, habitaciones, estados con historial y registro de quién limpió.
  - [x] Frontend: configuración con calculadora en vivo, tipos y tarifas, tablero por piso con cambio de estado e historial.
- [ ] **Ajustes antes de la Fase 4:** impuestos, personas extra, tope por hora, mantenimiento con fechas, zona horaria y Mi perfil. Detalle en [PLAN-TRABAJO-ACTUAL.md](PLAN-TRABAJO-ACTUAL.md).
- [x] **Fase 4 — Huéspedes:** registro y búsqueda.
  - [x] Backend: huéspedes (titular), búsqueda sin acentos, duplicados, VIP y bloqueo, datos fiscales CFDI 4.0 (varios RFC por huésped) y catálogos del SAT.
  - [x] Frontend: lista, ficha, formulario con aviso de duplicados, datos fiscales y componente "buscar o crear huésped".
- [ ] **Fase 5 — Reservas:** disponibilidad, creación, cancelación y prevención de doble reserva.
  - [x] Backend: reserva por tipo (habitación al llegar), modalidades noche/día/horas en la zona del hotel, precio congelado, disponibilidad con pico de ocupación y candado por tipo, folios, cotizar, calendario, modificar, cancelar y no-show.
  - [x] Frontend: calendario de ocupación (mapa de calor por tipo y día), llegadas y salidas de hoy, nueva reserva con cotización en vivo, lista, detalle y estancias en la ficha del huésped.
  - [ ] Temporadas y fines de semana (PR siguiente).
- [ ] **Fase 6 — Check-in / Check-out.**
- [ ] **Fase 7 — Cobros:** cargos, pagos y folio del huésped.
- [ ] **Fase 8 — Dashboard y reportes:** ocupación, llegadas y salidas del día.
- [ ] **Fase 9 — Limpieza y mantenimiento.**
