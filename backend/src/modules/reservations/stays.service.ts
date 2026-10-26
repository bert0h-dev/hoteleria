import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { RoomStatus } from '../../generated/prisma/enums.js';
import { todayIn } from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { WalkInDto } from './dto/stay-operations.dto.js';
import {
  lockRoomType,
  reservationInclude,
  ReservationsService,
  type Context,
} from './reservations.service.js';
import { computeQuote, suggestTimeCharge, type Modality } from './stay.js';

type Tx = Prisma.TransactionClient;

type ReservationRow = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

const STATUS_LABELS: Record<RoomStatus, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  CLEANING: 'Limpieza',
  MAINTENANCE: 'Mantenimiento',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

/**
 * Operación de recepción: check-in (con o sin reserva), cambio de
 * habitación, extender la estancia y check-out.
 */
@Injectable()
export class StaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
  ) {}

  /**
   * Habitaciones disponibles (limpias y libres) para asignar a una reserva:
   * las del tipo reservado y, como mejora de categoría, las de otros tipos
   * que tengan lugar en lo que resta de la estancia.
   */
  async availableRooms(actor: AuthUser, id: string) {
    const reservation = await this.findActive(actor, id);
    const ctx = await this.reservations.context(actor);
    const from = new Date(Math.max(Date.now(), reservation.checkIn.getTime()));

    const rooms = await this.prisma.room.findMany({
      where: { hotelId: actor.hotelId, isActive: true, status: 'AVAILABLE' },
      include: {
        roomType: { select: { id: true, name: true, nightlyRate: true } },
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });

    // Disponibilidad de cada tipo distinto al reservado (para mejoras).
    const otherTypes = [...new Set(rooms.map((r) => r.roomTypeId))].filter(
      (t) => t !== reservation.roomTypeId,
    );
    const typeAvailable = new Map<string, number>();
    for (const typeId of otherTypes) {
      const { available } = await this.reservations.availability(
        this.prisma,
        actor,
        typeId,
        { checkIn: from, checkOut: reservation.checkOut },
        ctx,
        reservation.id,
      );
      typeAvailable.set(typeId, available);
    }

    return rooms.map((room) => {
      const upgrade = room.roomTypeId !== reservation.roomTypeId;
      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        roomType: room.roomType,
        upgrade,
        // Del mismo tipo siempre se puede; de otro, solo si ese tipo tiene lugar.
        assignable: !upgrade || (typeAvailable.get(room.roomTypeId) ?? 0) > 0,
        lastCleanedAt: room.lastCleanedAt,
      };
    });
  }

  async checkIn(actor: AuthUser, id: string, roomId: string, reason?: string) {
    const reservation = await this.findActive(actor, id);
    if (reservation.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Solo se puede hacer check-in de una reserva confirmada',
      );
    }
    if (reservation.guest.isBlocked) {
      throw new BadRequestException(
        'El huésped está bloqueado; no se le puede hacer check-in',
      );
    }
    const ctx = await this.reservations.context(actor);
    const today = todayIn(ctx.timeZone);
    if (today < todayIn(ctx.timeZone, reservation.checkIn)) {
      throw new BadRequestException(
        'Aún no es el día de llegada; modifica la reserva si el huésped llegó antes',
      );
    }
    if (reservation.checkOut <= new Date()) {
      throw new BadRequestException(
        'La estancia ya terminó; márcala como "No se presentó"',
      );
    }

    const room = await this.findRoom(actor, roomId);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const typeChange = await this.prepareTypeChange(
        tx,
        actor,
        reservation,
        room,
        reason,
        ctx,
        now,
      );
      await occupyRoom(
        tx,
        actor,
        room,
        reservation.id,
        `Check-in ${reservation.code}`,
      );

      await tx.reservation.update({
        where: { id },
        data: {
          status: 'CHECKED_IN',
          roomId: room.id,
          checkedInAt: now,
          checkedInById: actor.id,
          ...typeChange,
        },
      });

      // Entrada antes de la hora (solo por noche: en día u horas la estancia
      // empieza a la hora de llegada).
      if (reservation.modality === 'NIGHTLY') {
        const early = suggestTimeCharge({
          scheduled: reservation.checkIn,
          actual: now,
          direction: 'early',
          nightlyRate: reservation.nightlyRate,
          graceMinutes: ctx.settings.graceMinutes,
          settings: ctx.settings,
        });
        if (early) {
          await tx.stayCharge.create({
            data: {
              hotelId: actor.hotelId,
              reservationId: id,
              kind: 'EARLY_CHECK_IN',
              description: `Entrada anticipada (${early.hours} h)`,
              hours: early.hours,
              amount: early.amount,
              createdById: actor.id,
            },
          });
        }
      }
      return tx.reservation.findUniqueOrThrow({
        where: { id },
        include: reservationInclude,
      });
    });
    return updated;
  }

  /** Llegada sin reserva: crea la reserva (origen mostrador) y hace el check-in. */
  async walkIn(actor: AuthUser, dto: WalkInDto) {
    const { roomId, reason, ...reservationDto } = dto;
    // Valida la habitación antes de crear la reserva.
    await this.findRoom(actor, roomId);
    const created = await this.reservations.create(actor, {
      ...reservationDto,
      roomTypeId: reservationDto.roomTypeId,
    });
    try {
      return await this.checkIn(actor, created.id, roomId, reason);
    } catch (error) {
      // Si el check-in falla, la reserva recién creada no debe quedar.
      await this.prisma.reservation.delete({ where: { id: created.id } });
      throw error;
    }
  }

  /** Cambio de habitación durante la estancia. */
  async moveRoom(actor: AuthUser, id: string, roomId: string, reason?: string) {
    const reservation = await this.findActive(actor, id);
    if (reservation.status !== 'CHECKED_IN' || !reservation.roomId) {
      throw new BadRequestException(
        'Solo se puede cambiar de habitación a un huésped en casa',
      );
    }
    if (reservation.roomId === roomId) {
      throw new BadRequestException('El huésped ya está en esa habitación');
    }
    const room = await this.findRoom(actor, roomId);
    const ctx = await this.reservations.context(actor);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const typeChange = await this.prepareTypeChange(
        tx,
        actor,
        reservation,
        room,
        reason,
        ctx,
        now,
      );
      await releaseRoom(
        tx,
        actor,
        reservation.roomId!,
        `Cambio de habitación ${reservation.code} → ${room.number}`,
      );
      await occupyRoom(
        tx,
        actor,
        room,
        id,
        `Cambio de habitación ${reservation.code}`,
      );
      await tx.reservation.update({
        where: { id },
        data: { roomId: room.id, ...typeChange },
      });
      return tx.reservation.findUniqueOrThrow({
        where: { id },
        include: reservationInclude,
      });
    });
  }

  /**
   * Extiende la estancia de un huésped en casa: revisa disponibilidad y
   * recalcula el precio completo con las reglas vigentes.
   */
  async extend(
    actor: AuthUser,
    id: string,
    input: { departureDate?: string; units?: number },
  ) {
    const reservation = await this.findActive(actor, id);
    if (reservation.status !== 'CHECKED_IN') {
      throw new BadRequestException(
        'Solo se puede extender la estancia de un huésped en casa',
      );
    }
    const ctx = await this.reservations.context(actor);
    const modality = reservation.modality as Modality;
    const arrivalDate = todayIn(ctx.timeZone, reservation.checkIn);

    if (modality === 'NIGHTLY' && !input.departureDate) {
      throw new BadRequestException('Indica la nueva fecha de salida');
    }
    if (modality !== 'NIGHTLY' && !input.units) {
      throw new BadRequestException('Indica la nueva duración');
    }

    const stay = this.reservations.stayOrThrow(
      {
        modality,
        arrivalDate,
        departureDate: input.departureDate,
        arrivalTime: timeOf(reservation.checkIn, ctx.timeZone),
        units: input.units,
        adults: reservation.adults,
        children: reservation.children,
      },
      ctx,
    );
    if (stay.checkOut <= reservation.checkOut) {
      throw new BadRequestException(
        'La nueva salida debe ser posterior a la actual',
      );
    }

    const type = await this.prisma.roomType.findUniqueOrThrow({
      where: { id: reservation.roomTypeId },
    });
    const calendar = await this.reservations.priceCalendar(
      actor,
      arrivalDate,
      modality,
      stay.units,
    );
    const quote = computeQuote(
      type,
      stay,
      modality,
      { adults: reservation.adults, children: reservation.children },
      ctx.settings,
      calendar,
    );

    return this.prisma.$transaction(async (tx) => {
      await lockRoomType(tx, type.id);
      const { available } = await this.reservations.availability(
        tx,
        actor,
        type.id,
        { checkIn: reservation.checkOut, checkOut: stay.checkOut },
        ctx,
        id,
      );
      if (available < 1) {
        throw new ConflictException(
          `No hay habitaciones «${type.name}» disponibles para extender hasta esa fecha`,
        );
      }
      return tx.reservation.update({
        where: { id },
        data: {
          checkOut: stay.checkOut,
          units: stay.units,
          baseAmount: quote.baseAmount,
          extrasAmount: quote.extrasAmount,
          totalAmount: quote.totalAmount,
          pricing: quote.detail as unknown as Prisma.InputJsonValue,
        },
        include: reservationInclude,
      });
    });
  }

  async checkOut(actor: AuthUser, id: string) {
    const reservation = await this.findActive(actor, id);
    if (reservation.status !== 'CHECKED_IN' || !reservation.roomId) {
      throw new BadRequestException(
        'Solo se puede hacer check-out de un huésped en casa',
      );
    }
    const ctx = await this.reservations.context(actor);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT',
          checkedOutAt: now,
          checkedOutById: actor.id,
        },
      });
      await releaseRoom(
        tx,
        actor,
        reservation.roomId!,
        `Check-out ${reservation.code}`,
      );

      const late = suggestTimeCharge({
        scheduled: reservation.checkOut,
        actual: now,
        direction: 'late',
        nightlyRate: reservation.nightlyRate,
        graceMinutes: ctx.settings.graceMinutes,
        settings: ctx.settings,
      });
      if (late) {
        await tx.stayCharge.create({
          data: {
            hotelId: actor.hotelId,
            reservationId: id,
            kind: 'LATE_CHECK_OUT',
            description: `Salida tardía (${late.hours} h)`,
            hours: late.hours,
            amount: late.amount,
            createdById: actor.id,
          },
        });
      }
      return tx.reservation.findUniqueOrThrow({
        where: { id },
        include: reservationInclude,
      });
    });
  }

  /** Huéspedes en casa, llegadas y salidas del día (pantalla de recepción). */
  async frontDesk(actor: AuthUser) {
    const ctx = await this.reservations.context(actor);
    const today = todayIn(ctx.timeZone);
    const [confirmed, inHouse] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { hotelId: actor.hotelId, status: 'CONFIRMED' },
        include: reservationInclude,
        orderBy: { checkIn: 'asc' },
      }),
      this.prisma.reservation.findMany({
        where: { hotelId: actor.hotelId, status: 'CHECKED_IN' },
        include: reservationInclude,
        orderBy: { checkOut: 'asc' },
      }),
    ]);
    const now = new Date();
    const localDay = (d: Date) => todayIn(ctx.timeZone, d);
    return {
      today,
      // Llegadas de hoy y llegadas atrasadas que aún pueden hacer check-in.
      arrivals: confirmed.filter(
        (r) => localDay(r.checkIn) <= today && r.checkOut > now,
      ),
      // Confirmadas cuya estancia ya terminó sin check-in.
      noShowCandidates: confirmed.filter((r) => r.checkOut <= now),
      inHouse: inHouse.map((r) => ({
        ...r,
        departsToday: localDay(r.checkOut) === today,
        overdue: r.checkOut < now,
      })),
    };
  }

  // -------------------------------------------------------------------------

  private async findActive(
    actor: AuthUser,
    id: string,
  ): Promise<ReservationRow> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    return reservation;
  }

  private async findRoom(actor: AuthUser, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, hotelId: actor.hotelId },
      include: { roomType: { select: { id: true, name: true } } },
    });
    if (!room) throw new NotFoundException('Habitación no encontrada');
    if (!room.isActive) {
      throw new BadRequestException(
        `La habitación ${room.number} está dada de baja`,
      );
    }
    if (room.status !== 'AVAILABLE') {
      throw new BadRequestException(
        `La habitación ${room.number} no está disponible (${STATUS_LABELS[room.status]})`,
      );
    }
    return room;
  }

  /**
   * Si la habitación es de otro tipo (mejora de categoría): exige motivo,
   * revisa que ese tipo tenga lugar en lo que resta de la estancia y
   * devuelve los cambios para la reserva. El precio no cambia.
   */
  private async prepareTypeChange(
    tx: Tx,
    actor: AuthUser,
    reservation: ReservationRow,
    room: { roomTypeId: string; roomType: { name: string } },
    reason: string | undefined,
    ctx: Context,
    now: Date,
  ): Promise<Prisma.ReservationUncheckedUpdateInput> {
    if (room.roomTypeId === reservation.roomTypeId) return {};
    if (!reason) {
      throw new BadRequestException(
        `La habitación es de otro tipo («${room.roomType.name}»); indica el motivo de la mejora de categoría`,
      );
    }
    await lockRoomType(tx, room.roomTypeId);
    const from = new Date(
      Math.max(now.getTime(), reservation.checkIn.getTime()),
    );
    const { available } = await this.reservations.availability(
      tx,
      actor,
      room.roomTypeId,
      { checkIn: from, checkOut: reservation.checkOut },
      ctx,
      reservation.id,
    );
    if (available < 1) {
      throw new ConflictException(
        `No hay habitaciones «${room.roomType.name}» libres para toda la estancia`,
      );
    }
    return {
      roomTypeId: room.roomTypeId,
      // Se conserva el tipo que se reservó originalmente.
      bookedRoomTypeId: reservation.bookedRoomTypeId ?? reservation.roomTypeId,
      upgradeReason: reason,
    };
  }
}

// ---------------------------------------------------------------------------

/** Disponible → Ocupada, solo si nadie la tomó mientras tanto. */
async function occupyRoom(
  tx: Tx,
  actor: AuthUser,
  room: { id: string; number: string },
  reservationId: string,
  reason: string,
) {
  const { count } = await tx.room.updateMany({
    where: { id: room.id, status: 'AVAILABLE', isActive: true },
    data: { status: 'OCCUPIED', blockedUntil: null },
  });
  if (count === 0) {
    throw new ConflictException(
      `Otra persona ocupó la habitación ${room.number}. Elige otra.`,
    );
  }
  const busy = await tx.reservation.count({
    where: {
      roomId: room.id,
      status: 'CHECKED_IN',
      id: { not: reservationId },
    },
  });
  if (busy > 0) {
    throw new ConflictException(
      `La habitación ${room.number} ya tiene un huésped`,
    );
  }
  await tx.roomStatusLog.create({
    data: {
      hotelId: actor.hotelId,
      roomId: room.id,
      fromStatus: 'AVAILABLE',
      toStatus: 'OCCUPIED',
      reason,
      changedById: actor.id,
    },
  });
}

/** Ocupada → Limpieza (al salir o cambiar de habitación). */
async function releaseRoom(
  tx: Tx,
  actor: AuthUser,
  roomId: string,
  reason: string,
) {
  const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
  await tx.room.update({ where: { id: roomId }, data: { status: 'CLEANING' } });
  await tx.roomStatusLog.create({
    data: {
      hotelId: actor.hotelId,
      roomId,
      fromStatus: room.status,
      toStatus: 'CLEANING',
      reason,
      changedById: actor.id,
    },
  });
}

/** HH:mm de un instante en la zona del hotel. */
function timeOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
