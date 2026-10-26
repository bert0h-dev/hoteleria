import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { Env } from '../../config/env.validation.js';
import type { JwtPayload } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { userSelect, type PublicUser } from '../users/user.select.js';
import type { LoginDto } from './dto/login.dto.js';
import type {
  ChangeOwnPasswordDto,
  UpdateProfileDto,
} from './dto/profile.dto.js';

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const INVALID_SESSION = 'Sesión inválida o expirada';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(dto: LoginDto, meta: ClientMeta): Promise<Session> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid =
      user && user.isActive && (await verify(user.passwordHash, dto.password));
    if (!valid) throw new UnauthorizedException(INVALID_CREDENTIALS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.createSession(user.id, meta);
  }

  /** Cambia un refresh token válido por una sesión nueva (rotación). */
  async refresh(refreshToken: string, meta: ClientMeta): Promise<Session> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: { isActive: true } } },
    });
    if (!stored) throw new UnauthorizedException(INVALID_SESSION);

    if (stored.revokedAt) {
      // Si un token ya rotado se vuelve a usar, puede haber sido robado:
      // se cierran todas las sesiones del usuario.
      if (stored.rotated) await this.revokeAll(stored.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (stored.expiresAt <= new Date() || !stored.user.isActive) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date(), rotated: true },
    });
    if (count === 0) throw new UnauthorizedException(INVALID_SESSION);

    return this.createSession(stored.userId, meta);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser & { hasAuthPin: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelect, authPinHash: true },
    });
    if (!user?.isActive) throw new UnauthorizedException(INVALID_SESSION);
    const { authPinHash, ...rest } = user;
    return { ...rest, hasAuthPin: !!authPinHash };
  }

  /** El usuario actualiza sus propios datos (nombre y teléfono). */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    await this.me(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone },
      select: userSelect,
    });
  }

  /**
   * El usuario cambia su propia contraseña. Exige la actual y cierra sus
   * demás sesiones; la sesión desde la que se hace el cambio sigue abierta.
   */
  async changeOwnPassword(
    userId: string,
    dto: ChangeOwnPasswordDto,
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new UnauthorizedException(INVALID_SESSION);

    if (!(await verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la actual',
      );
    }

    const keepHash = currentRefreshToken
      ? hashToken(currentRefreshToken)
      : undefined;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hash(dto.newPassword) },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(keepHash && { tokenHash: { not: keepHash } }),
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /** Revoca todas las sesiones abiertas de un usuario. */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(
    userId: string,
    meta: ClientMeta,
  ): Promise<Session> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: userSelect,
    });

    const payload: JwtPayload = {
      sub: user.id,
      hotelId: user.hotelId,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    const refreshExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt, user };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
