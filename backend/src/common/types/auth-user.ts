import type { Role } from '../../generated/prisma/client.js';

/** Datos del usuario autenticado, tomados del access token. */
export interface AuthUser {
  id: string;
  hotelId: string;
  role: Role;
}

/** Contenido (payload) del access token JWT. */
export interface JwtPayload {
  sub: string;
  hotelId: string;
  role: Role;
}
