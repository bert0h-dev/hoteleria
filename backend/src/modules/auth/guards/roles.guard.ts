import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../../../generated/prisma/client.js';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../../common/types/auth-user.js';

/** Guard global: valida los roles indicados con @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
