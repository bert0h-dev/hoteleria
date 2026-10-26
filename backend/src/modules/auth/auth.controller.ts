import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env.validation.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AuthService, type ClientMeta, type Session } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangeOwnPasswordDto, UpdateProfileDto } from './dto/profile.dto.js';

export const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Access token y datos del usuario' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(dto, clientMeta(req));
    return this.respond(res, session);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ description: 'Nuevo access token (rota el refresh token)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Sesión no iniciada');
    try {
      const session = await this.auth.refresh(token, clientMeta(req));
      return this.respond(res, session);
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Usuario autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** Mi perfil: el usuario cambia su nombre y teléfono. */
  @Patch('me')
  @ApiBearerAuth()
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  /** Mi perfil: cambiar la contraseña propia (cierra las demás sesiones). */
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changeOwnPassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeOwnPasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.changeOwnPassword(user.id, dto, readRefreshCookie(req));
  }

  private respond(res: Response, session: Session) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      expires: session.refreshExpiresAt,
    });
    return { accessToken: session.accessToken, user: session.user };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/api/auth',
    };
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[REFRESH_COOKIE];
}

function clientMeta(req: Request): ClientMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}
