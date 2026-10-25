import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const publicUser = {
  id: 'u1',
  hotelId: 'h1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue(publicUser),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('access-token') };
  const config = { get: vi.fn().mockReturnValue(7) };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );
  return { service, prisma, jwt };
}

describe('AuthService', () => {
  describe('login', () => {
    it('crea una sesión con credenciales válidas', async () => {
      const { service, prisma, jwt } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...publicUser,
        passwordHash: await hash('secreto123'),
      });

      const session = await service.login(
        { email: 'admin@test.com', password: 'secreto123' },
        {},
      );

      expect(session.accessToken).toBe('access-token');
      expect(session.refreshToken).toHaveLength(64);
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        hotelId: 'h1',
        role: 'ADMIN',
      });
      // Solo se guarda el hash del refresh token, nunca el valor original.
      const stored = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(stored.tokenHash).not.toBe(session.refreshToken);
      expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rechaza una contraseña incorrecta', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...publicUser,
        passwordHash: await hash('secreto123'),
      });

      await expect(
        service.login({ email: 'admin@test.com', password: 'otra' }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza a un usuario inexistente o inactivo', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'x@test.com', password: 'a' }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.user.findUnique.mockResolvedValueOnce({
        ...publicUser,
        isActive: false,
        passwordHash: await hash('secreto123'),
      });
      await expect(
        service.login({ email: 'admin@test.com', password: 'secreto123' }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const validToken = {
      id: 'rt1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { isActive: true },
    };

    it('rota el token: revoca el actual y emite uno nuevo', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue(validToken);

      const session = await service.refresh('token', {});

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt1', revokedAt: null } }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
      expect(session.accessToken).toBe('access-token');
    });

    it('si se reusa un token revocado, cierra todas las sesiones', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validToken,
        revokedAt: new Date(),
      });

      await expect(service.refresh('token', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rechaza tokens expirados o inexistentes', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        ...validToken,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('token', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.refresh('token', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
