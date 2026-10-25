import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { RoomStatus } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RoomTypesService } from '../room-types/room-types.service.js';
import type {
  ChangeRoomStatusDto,
  CreateRoomDto,
  QueryRoomsDto,
  UpdateRoomDto,
} from './dto/room.dto.js';
import {
  canChangeStatus,
  completesCleaning,
  requiresReason,
  ROOM_STATUS_LABELS,
} from './room-status.rules.js';

const personSelect = { select: { id: true, name: true } } as const;

const roomInclude = {
  roomType: { select: { id: true, name: true, nightlyRate: true } },
  lastCleanedBy: personSelect,
} satisfies Prisma.RoomInclude;

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomTypes: RoomTypesService,
  ) {}

  findAll(actor: AuthUser, query: QueryRoomsDto) {
    const search = query.search?.trim().toUpperCase();
    return this.prisma.room.findMany({
      where: {
        hotelId: actor.hotelId,
        status: query.status,
        floor: query.floor,
        roomTypeId: query.roomTypeId,
        ...(!query.includeInactive && { isActive: true }),
        ...(search && { number: { contains: search } }),
      },
      include: roomInclude,
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
  }

  /** Cantidad de habitaciones activas por estado. */
  async summary(actor: AuthUser) {
    const groups = await this.prisma.room.groupBy({
      by: ['status'],
      where: { hotelId: actor.hotelId, isActive: true },
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      Object.values(RoomStatus).map((s) => [s, 0]),
    ) as Record<RoomStatus, number>;
    for (const g of groups) byStatus[g.status] = g._count._all;
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    return { total, byStatus };
  }

  async findOne(actor: AuthUser, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: roomInclude,
    });
    if (!room) throw new NotFoundException('Habitación no encontrada');
    return room;
  }

  async create(actor: AuthUser, dto: CreateRoomDto) {
    await this.roomTypes.findOrThrow(actor, dto.roomTypeId);
    try {
      return await this.prisma.room.create({
        data: {
          hotelId: actor.hotelId,
          roomTypeId: dto.roomTypeId,
          number: dto.number,
          floor: dto.floor,
          notes: dto.notes,
        },
        include: roomInclude,
      });
    } catch (error) {
      throw mapUniqueNumber(error);
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateRoomDto) {
    await this.findOne(actor, id);
    if (dto.roomTypeId) await this.roomTypes.findOrThrow(actor, dto.roomTypeId);
    try {
      return await this.prisma.room.update({
        where: { id },
        data: dto,
        include: roomInclude,
      });
    } catch (error) {
      throw mapUniqueNumber(error);
    }
  }

  async changeStatus(actor: AuthUser, id: string, dto: ChangeRoomStatusDto) {
    const room = await this.findOne(actor, id);
    const from = room.status;
    const to = dto.status;

    if (!room.isActive) {
      throw new BadRequestException('La habitación está dada de baja');
    }
    if (from === to) {
      throw new BadRequestException(
        `La habitación ya está en estado «${ROOM_STATUS_LABELS[to]}»`,
      );
    }
    if (!canChangeStatus(actor.role, from, to)) {
      throw new ForbiddenException(
        `Tu rol no puede cambiar una habitación de «${ROOM_STATUS_LABELS[from]}» a «${ROOM_STATUS_LABELS[to]}»`,
      );
    }

    if (requiresReason(to) && !dto.reason) {
      throw new BadRequestException(
        `Indica el motivo para pasar la habitación a «${ROOM_STATUS_LABELS[to]}»`,
      );
    }

    const isCleaningDone = completesCleaning(from, to);
    if (dto.cleanedById && !isCleaningDone) {
      throw new BadRequestException(
        'Solo se indica quién limpió al pasar de «Limpieza» a «Disponible»',
      );
    }
    const cleanedById = isCleaningDone
      ? await this.resolveCleaner(actor, dto.cleanedById)
      : null;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Solo cambia si nadie lo modificó mientras tanto.
      const { count } = await tx.room.updateMany({
        where: { id, status: from },
        data: {
          status: to,
          ...(cleanedById && {
            lastCleanedAt: now,
            lastCleanedById: cleanedById,
          }),
        },
      });
      if (count === 0) {
        throw new ConflictException(
          'Otra persona cambió el estado de la habitación. Actualiza e inténtalo de nuevo.',
        );
      }
      await tx.roomStatusLog.create({
        data: {
          hotelId: actor.hotelId,
          roomId: id,
          fromStatus: from,
          toStatus: to,
          reason: dto.reason,
          changedById: actor.id,
          cleanedById,
          cleanedAt: cleanedById ? now : null,
        },
      });
      return tx.room.findUniqueOrThrow({
        where: { id },
        include: roomInclude,
      });
    });
  }

  async history(actor: AuthUser, id: string) {
    await this.findOne(actor, id);
    return this.prisma.roomStatusLog.findMany({
      where: { roomId: id },
      include: { changedBy: personSelect, cleanedBy: personSelect },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Personal de limpieza activo del hotel (para indicar quién limpió). */
  housekeepers(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: { hotelId: actor.hotelId, role: 'HOUSEKEEPING', isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Quién limpió: si lo hace alguien de limpieza, es esa persona; si lo
   * marca recepción o un administrador, puede indicar a alguien de limpieza
   * (o queda registrado él mismo).
   */
  private async resolveCleaner(
    actor: AuthUser,
    cleanedById: string | undefined,
  ): Promise<string> {
    if (actor.role === 'HOUSEKEEPING' || !cleanedById) return actor.id;
    const cleaner = await this.prisma.user.findFirst({
      where: {
        id: cleanedById,
        hotelId: actor.hotelId,
        role: 'HOUSEKEEPING',
        isActive: true,
      },
      select: { id: true },
    });
    if (!cleaner) {
      throw new BadRequestException(
        'La persona indicada no es personal de limpieza activo',
      );
    }
    return cleaner.id;
  }
}

function mapUniqueNumber(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException('Ya existe una habitación con ese número');
  }
  return error;
}
