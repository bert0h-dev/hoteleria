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
import { toDbDate } from '../../common/time/hotel-date.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService, changedFields } from '../audit/audit.service.js';
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
    private readonly audit: AuditService,
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
      const user = await this.prisma.user.create({
        data: {
          hotelId: actor.hotelId,
          name: dto.name,
          email: dto.email,
          role: dto.role,
          phone: dto.phone,
          employeeNumber: dto.employeeNumber,
          hireDate: dto.hireDate ? toDbDate(dto.hireDate) : dto.hireDate,
          passwordHash: await hash(dto.password),
        },
        select: userSelect,
      });
      await this.audit.log(actor, {
        action: 'user.create',
        entity: 'user',
        entityId: user.id,
        summary: `Creó el usuario ${user.name} (${user.email}) con rol ${user.role}`,
      });
      return user;
    } catch (error) {
      throw mapUniqueEmail(error);
    }
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<PublicUser> {
    const current = await this.findOne(actor, id);

    // El personal de limpieza no cobra ni autoriza.
    const finalRole = dto.role ?? current.role;
    const housekeeping = finalRole === 'HOUSEKEEPING';
    if (housekeeping && (dto.canAuthorize || dto.canDiscountUnlimited)) {
      throw new BadRequestException(
        'El personal de limpieza no puede tener permisos de cobro ni autorizar',
      );
    }

    // Evita que un administrador se quede sin acceso por error.
    if (id === actor.id) {
      if (dto.isActive === false) {
        throw new BadRequestException('No puedes desactivar tu propio usuario');
      }
      if (dto.role && dto.role !== actor.role) {
        throw new BadRequestException('No puedes cambiar tu propio rol');
      }
    }

    const user = await this.prisma.user
      .update({
        where: { id },
        data: {
          name: dto.name,
          role: dto.role,
          isActive: dto.isActive,
          // Al pasar a limpieza se le quitan los permisos de cobro y su PIN.
          ...(housekeeping
            ? {
                canAuthorize: false,
                canDiscountUnlimited: false,
                authPinHash: null,
              }
            : {
                canAuthorize: dto.canAuthorize,
                canDiscountUnlimited: dto.canDiscountUnlimited,
              }),
          phone: dto.phone,
          employeeNumber: dto.employeeNumber,
          hireDate: dto.hireDate ? toDbDate(dto.hireDate) : dto.hireDate,
        },
        select: userSelect,
      })
      .catch((error: unknown) => {
        throw mapUniqueEmail(error);
      });
    if (dto.isActive === false) await this.auth.revokeAll(id);
    const changes = changedFields(current, dto);
    if (Object.keys(changes).length) {
      await this.audit.log(actor, {
        action: 'user.update',
        entity: 'user',
        entityId: id,
        summary: `Modificó el usuario ${user.name} (${Object.keys(changes).join(', ')})`,
        data: changes as never,
      });
    }
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
    // El índice único que falló dice qué campo está repetido.
    const target = JSON.stringify(error.meta ?? {});
    return new ConflictException(
      target.includes('employee')
        ? 'Ya existe un usuario con ese número de empleado'
        : 'Ya existe un usuario con ese correo',
    );
  }
  return error;
}
