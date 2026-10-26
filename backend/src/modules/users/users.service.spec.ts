import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { UsersService } from './users.service.js';

const admin: AuthUser = { id: 'admin', hotelId: 'h1', role: 'ADMIN' };

function setup() {
  const prisma = {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'u2', hotelId: 'h1' }),
      create: vi.fn().mockResolvedValue({ id: 'u3', name: 'Nuevo' }),
      update: vi.fn().mockResolvedValue({ id: 'u2' }),
    },
  };
  const auth = { revokeAll: vi.fn() };
  const audit = { log: vi.fn() };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
    audit as unknown as AuditService,
  );
  return { service, prisma, auth };
}

describe('UsersService', () => {
  it('solo busca usuarios del hotel del administrador', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findOne(admin, 'otro')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'otro', hotelId: 'h1' } }),
    );
  });

  it('crea el usuario en el hotel del administrador con la contraseña hasheada', async () => {
    const { service, prisma } = setup();
    await service.create(admin, {
      name: 'Ana',
      email: 'ana@test.com',
      password: 'secreto123',
      role: 'RECEPTION',
    });

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.hotelId).toBe('h1');
    expect(data.passwordHash).toMatch(/^\$argon2/);
    expect(data).not.toHaveProperty('password');
  });

  it('convierte un correo duplicado en 409', async () => {
    const { service, prisma } = setup();
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(admin, {
        name: 'Ana',
        email: 'ana@test.com',
        password: 'secreto123',
        role: 'RECEPTION',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('impide que el administrador se desactive o cambie su propio rol', async () => {
    const { service } = setup();
    await expect(
      service.update(admin, 'admin', { isActive: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(admin, 'admin', { role: 'RECEPTION' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('al desactivar un usuario cierra sus sesiones', async () => {
    const { service, auth } = setup();
    await service.update(admin, 'u2', { isActive: false });
    expect(auth.revokeAll).toHaveBeenCalledWith('u2');
  });

  it('al cambiar la contraseña cierra las sesiones del usuario', async () => {
    const { service, auth } = setup();
    await service.changePassword(admin, 'u2', 'nueva12345');
    expect(auth.revokeAll).toHaveBeenCalledWith('u2');
  });
});
