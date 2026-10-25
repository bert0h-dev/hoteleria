import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Paginated } from '../../common/types/paginated.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { userSelect, type PublicUser } from './user.select.js';

/** Gestión de usuarios, siempre limitada al hotel del usuario autenticado. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async findAll(
    actor: AuthUser,
    query: QueryUsersDto,
  ): Promise<Paginated<PublicUser>> {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      hotelId: actor.hotelId,
      role: query.role,
      isActive: query.isActive,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(actor: AuthUser, id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, hotelId: actor.hotelId },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(actor: AuthUser, dto: CreateUserDto): Promise<PublicUser> {
    try {
      return await this.prisma.user.create({
        data: {
          hotelId: actor.hotelId,
          name: dto.name,
          email: dto.email,
          role: dto.role,
          passwordHash: await hash(dto.password),
        },
        select: userSelect,
      });
    } catch (error) {
      throw mapUniqueEmail(error);
    }
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<PublicUser> {
    await this.findOne(actor, id);

    // Evita que un administrador se quede sin acceso por error.
    if (id === actor.id) {
      if (dto.isActive === false) {
        throw new BadRequestException('No puedes desactivar tu propio usuario');
      }
      if (dto.role && dto.role !== actor.role) {
        throw new BadRequestException('No puedes cambiar tu propio rol');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: userSelect,
    });
    if (dto.isActive === false) await this.auth.revokeAll(id);
    return user;
  }

  async changePassword(
    actor: AuthUser,
    id: string,
    password: string,
  ): Promise<void> {
    await this.findOne(actor, id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hash(password) },
    });
    // Cierra las sesiones abiertas con la contraseña anterior.
    await this.auth.revokeAll(id);
  }
}

function mapUniqueEmail(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException('Ya existe un usuario con ese correo');
  }
  return error;
}
