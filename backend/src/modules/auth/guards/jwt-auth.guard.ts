import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import type { AuthUser, JwtPayload } from '../../../common/types/auth-user.js';

/** Guard global: exige un access token válido salvo en rutas @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Sesión no iniciada');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = {
        id: payload.sub,
        hotelId: payload.hotelId,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    return true;
  }
}
