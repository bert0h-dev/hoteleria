import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { RoomStatus } from '../../generated/prisma/enums.js';
import {
  fromDbDate,
  isBlockOverdue,
  todayIn,
  toDbDate,
} from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  cancelActiveTasks,
  completeDepartureTask,
  openDepartureTask,
} from '../cleaning/cleaning-hooks.js';
import { RoomTypesService } from '../room-types/room-types.service.js';
import type {
  ChangeRoomStatusDto,
  CreateRoomDto,
  QueryRoomsDto,
  UpdateBlockedUntilDto,
  UpdateRoomDto,
} from './dto/room.dto.js';
import {
  canChangeStatus,
  completesCleaning,
  isBlockingStatus,
  requiresBlockedUntil,
  requiresReason,
  ROOM_STATUS_LABELS,
} from './room-status.rules.js';

const personSelect = { select: { id: true, name: true } } as const;

const roomInclude = {
  roomType: { select: { id: true, name: true, nightlyRate: true } },
  lastCleanedBy: personSelect,
  // Estancia en curso (huésped en casa).
  reservations: {
    where: { status: 'CHECKED_IN' },
    take: 1,
    select: {
      id: true,
      code: true,
      checkIn: true,
      checkOut: true,
      guest: {
        select: { id: true, firstName: true, lastName: true, isVip: true },
      },
    },
  },
} satisfies Prisma.RoomInclude;

type RoomRow = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

const BLOCKING: RoomStatus[] = ['MAINTENANCE', 'OUT_OF_SERVICE'];

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomTypes: RoomTypesService,
  ) {}

  async findAll(actor: AuthUser, query: QueryRoomsDto) {
    const timeZone = await this.timeZone(actor);
    const search = query.search?.trim().toUpperCase();
    const rooms = await this.prisma.room.findMany({
      where: {
        hotelId: actor.hotelId,
        status: query.status,
        floor: query.floor,
        roomTypeId: query.roomTypeId,
        ...(!query.includeInactive && { isActive: true }),
        ...(search && { number: { contains: search } }),
        ...(query.overdue && overdueWhere(timeZone)),
      },
      include: roomInclude,
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
    return rooms.map((room) => present(room, timeZone));
  }

  /** Cantidad de habitaciones activas por estado y bloqueos vencidos. */
  async summary(actor: AuthUser) {
    const timeZone = await this.timeZone(actor);
    const where = { hotelId: actor.hotelId, isActive: true };
    const [groups, overdue] = await Promise.all([
      this.prisma.room.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.room.count({
        where: { ...where, ...overdueWhere(timeZone) },
      }),
    ]);
    const byStatus = Object.fromEntries(
      Object.values(RoomStatus).map((s) => [s, 0]),
    ) as Record<RoomStatus, number>;
    for (const g of groups) byStatus[g.status] = g._count._all;
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    return { total, byStatus, overdue };
  }

  async findOne(actor: AuthUser, id: string) {
    const room = await this.findRow(actor, id);
    return present(room, await this.timeZone(actor));
  }

  async create(actor: AuthUser, dto: CreateRoomDto) {
    await this.roomTypes.findOrThrow(actor, dto.roomTypeId);
    try {
      const room = await this.prisma.room.create({
        data: {
          hotelId: actor.hotelId,
          roomTypeId: dto.roomTypeId,
          number: dto.number,
          floor: dto.floor,
          notes: dto.notes,
        },
        include: roomInclude,
      });
      return present(room, await this.timeZone(actor));
    } catch (error) {
      throw mapUniqueNumber(error);
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateRoomDto) {
    await this.findRow(actor, id);
    if (dto.roomTypeId) await this.roomTypes.findOrThrow(actor, dto.roomTypeId);
    try {
      const room = await this.prisma.room.update({
        where: { id },
        data: dto,
        include: roomInclude,
      });
      return present(room, await this.timeZone(actor));
    } catch (error) {
      throw mapUniqueNumber(error);
    }
  }

  async changeStatus(actor: AuthUser, id: string, dto: ChangeRoomStatusDto) {
    const room = await this.findRow(actor, id);
    const timeZone = await this.timeZone(actor);
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
    if (to === 'OCCUPIED') {
      throw new BadRequestException(
        'Una habitación se ocupa con el check-in de una reserva',
      );
    }
    // Una ocupada con huésped en casa solo se libera con check-out o cambio
    // de habitación. Sin estancia activa (dato viejo o error) sí se permite.
    const activeStay = room.reservations[0];
    if (from === 'OCCUPIED' && activeStay) {
      throw new BadRequestException(
        `La habitación tiene un huésped en casa (${activeStay.code}); usa el check-out o el cambio de habitación`,
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

    // Fecha estimada de fin: solo en estados de bloqueo.
    if (requiresBlockedUntil(to) && !dto.blockedUntil) {
      throw new BadRequestException(
        `Indica hasta qué fecha estará en «${ROOM_STATUS_LABELS[to]}»`,
      );
    }
    if (dto.blockedUntil && !isBlockingStatus(to)) {
      throw new BadRequestException(
        'La fecha estimada solo aplica a «Mantenimiento» o «Fuera de servicio»',
      );
    }
    if (dto.blockedUntil) assertNotPast(dto.blockedUntil, timeZone);
    const blockedUntil = dto.blockedUntil ? toDbDate(dto.blockedUntil) : null;

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

    const updated = await this.prisma.$transaction(async (tx) => {
      // Solo cambia si nadie lo modificó mientras tanto.
      const { count } = await tx.room.updateMany({
        where: { id, status: from },
        data: {
          status: to,
          // Al salir de un bloqueo la fecha se borra sola.
          blockedUntil,
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
      // Las tareas de limpieza siguen al estado de la habitación.
      let cleaningTaskId: string | null = null;
      if (cleanedById) {
        cleaningTaskId = await completeDepartureTask(tx, {
          roomId: id,
          cleanedById,
          at: now,
        });
      } else if (to === 'CLEANING') {
        await openDepartureTask(tx, {
          hotelId: actor.hotelId,
          roomId: id,
          requestedById: actor.id,
        });
      } else if (from === 'CLEANING') {
        await cancelActiveTasks(tx, {
          roomId: id,
          reason: `La habitación pasó a «${ROOM_STATUS_LABELS[to]}»`,
        });
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
          cleaningTaskId,
          blockedUntil,
        },
      });
      return tx.room.findUniqueOrThrow({
        where: { id },
        include: roomInclude,
      });
    });
    return present(updated, timeZone);
  }

  /** Ajusta la fecha estimada de un bloqueo sin cambiar el estado. */
  async updateBlockedUntil(
    actor: AuthUser,
    id: string,
    dto: UpdateBlockedUntilDto,
  ) {
    const room = await this.findRow(actor, id);
    const timeZone = await this.timeZone(actor);

    if (!isBlockingStatus(room.status)) {
      throw new BadRequestException(
        'Solo se ajusta la fecha de habitaciones en «Mantenimiento» o «Fuera de servicio»',
      );
    }
    if (!dto.blockedUntil && requiresBlockedUntil(room.status)) {
      throw new BadRequestException(
        `Una habitación en «${ROOM_STATUS_LABELS[room.status]}» necesita fecha estimada`,
      );
    }
    if (dto.blockedUntil) assertNotPast(dto.blockedUntil, timeZone);

    const blockedUntil = dto.blockedUntil ? toDbDate(dto.blockedUntil) : null;
    const previous = room.blockedUntil;
    if ((previous?.getTime() ?? null) === (blockedUntil?.getTime() ?? null)) {
      throw new BadRequestException('La fecha estimada no cambió');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({ where: { id }, data: { blockedUntil } });
      // Mismo estado de origen y destino = ajuste de fecha.
      await tx.roomStatusLog.create({
        data: {
          hotelId: actor.hotelId,
          roomId: id,
          fromStatus: room.status,
          toStatus: room.status,
          changedById: actor.id,
          blockedUntil,
          previousBlockedUntil: previous,
        },
      });
      return tx.room.findUniqueOrThrow({
        where: { id },
        include: roomInclude,
      });
    });
    return present(updated, timeZone);
  }

  async history(actor: AuthUser, id: string) {
    await this.findRow(actor, id);
    const logs = await this.prisma.roomStatusLog.findMany({
      where: { roomId: id },
      include: { changedBy: personSelect, cleanedBy: personSelect },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return logs.map((log) => ({
      ...log,
      blockedUntil: log.blockedUntil && fromDbDate(log.blockedUntil),
      previousBlockedUntil:
        log.previousBlockedUntil && fromDbDate(log.previousBlockedUntil),
    }));
  }

  /** Personal de limpieza activo del hotel (para indicar quién limpió). */
  housekeepers(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: { hotelId: actor.hotelId, role: 'HOUSEKEEPING', isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  private async findRow(actor: AuthUser, id: string): Promise<RoomRow> {
    const room = await this.prisma.room.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: roomInclude,
    });
    if (!room) throw new NotFoundException('Habitación no encontrada');
    return room;
  }

  private async timeZone(actor: AuthUser): Promise<string> {
    const hotel = await this.prisma.hotel.findUniqueOrThrow({
      where: { id: actor.hotelId },
      select: { timezone: true },
    });
    return hotel.timezone;
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

/** Respuesta de la API: fecha como YYYY-MM-DD y si el bloqueo ya venció. */
function present(room: RoomRow, timeZone: string) {
  const { reservations, ...rest } = room;
  return {
    ...rest,
    currentStay: reservations[0] ?? null,
    blockedUntil: rest.blockedUntil && fromDbDate(rest.blockedUntil),
    blockOverdue:
      isBlockingStatus(room.status) &&
      isBlockOverdue(room.blockedUntil, timeZone),
  };
}

function overdueWhere(timeZone: string): Prisma.RoomWhereInput {
  return {
    status: { in: BLOCKING },
    blockedUntil: { lt: toDbDate(todayIn(timeZone)) },
  };
}

function assertNotPast(date: string, timeZone: string) {
  if (date < todayIn(timeZone)) {
    throw new BadRequestException(
      'La fecha estimada no puede estar en el pasado',
    );
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
