import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Datos que manda el diálogo de autorización. */
export interface AuthorizationInput {
  authorizerId: string;
  pin: string;
}

/**
 * Autorizaciones en el momento: un usuario con permiso para autorizar
 * escribe su PIN y queda registrado quién autorizó.
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Permisos del usuario que hace la operación. */
  async permissions(actor: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { canAuthorize: true, canDiscountUnlimited: true },
    });
    return user;
  }

  /**
   * Devuelve quién autoriza la operación:
   * - Si el propio usuario puede autorizar, se registra él mismo.
   * - Si no, exige la autorización (usuario + PIN) de alguien que pueda.
   */
  async resolve(
    actor: AuthUser,
    authorization: AuthorizationInput | undefined,
    what: string,
  ): Promise<string> {
    const { canAuthorize } = await this.permissions(actor);
    if (canAuthorize) return actor.id;
    if (!authorization) {
      throw new ForbiddenException(`${what} requiere autorización`);
    }
    return this.verify(actor.hotelId, authorization);
  }

  /** Valida usuario + PIN y devuelve el id de quien autorizó. */
  async verify(hotelId: string, input: AuthorizationInput): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.authorizerId,
        hotelId,
        isActive: true,
        canAuthorize: true,
        // Limpieza nunca autoriza, aunque el dato quedara mal.
        role: { not: 'HOUSEKEEPING' },
      },
      select: { id: true, authPinHash: true },
    });
    if (!user?.authPinHash) {
      throw new ForbiddenException(
        'Ese usuario no puede autorizar o aún no configura su PIN',
      );
    }
    if (!(await verify(user.authPinHash, input.pin))) {
      throw new ForbiddenException('El PIN de autorización es incorrecto');
    }
    return user.id;
  }

  /** Usuarios que pueden autorizar (para el diálogo). */
  authorizers(hotelId: string) {
    return this.prisma.user
      .findMany({
        where: {
          hotelId,
          isActive: true,
          canAuthorize: true,
          role: { not: 'HOUSEKEEPING' },
        },
        select: { id: true, name: true, role: true, authPinHash: true },
        orderBy: { name: 'asc' },
      })
      .then((users) =>
        users.map(({ authPinHash, ...u }) => ({ ...u, hasPin: !!authPinHash })),
      );
  }

  /** El propio usuario define o cambia su PIN (exige su contraseña). */
  async setOwnPin(actor: AuthUser, currentPassword: string, pin: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { canAuthorize: true, passwordHash: true },
    });
    if (!user.canAuthorize) {
      throw new ForbiddenException(
        'Tu usuario no tiene permiso para autorizar; pídeselo a un administrador',
      );
    }
    if (!(await verify(user.passwordHash, currentPassword))) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { authPinHash: await hash(pin) },
    });
  }
}
