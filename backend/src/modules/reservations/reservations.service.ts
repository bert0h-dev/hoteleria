import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type RoomType } from '../../generated/prisma/client.js';
import type {
  ReservationStatus,
  StayModality,
} from '../../generated/prisma/enums.js';
import {
  addDaysTo,
  todayIn,
  toDbDate,
  zonedToUtc,
} from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Paginated } from '../../common/types/paginated.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { HotelService } from '../hotel/hotel.service.js';
import { RatePeriodsService } from '../rate-periods/rate-periods.service.js';
import { searchTerms } from '../guests/guest-search.js';
import type {
  CalendarQueryDto,
  CreateReservationDto,
  QueryReservationsDto,
  StayDto,
  UpdateReservationDto,
} from './dto/reservation.dto.js';
import {
  computeQuote,
  computeStay,
  peakOccupancy,
  StayError,
  type PriceCalendar,
  type Stay,
  type StaySettings,
} from './stay.js';

type Tx = Prisma.TransactionClient;

/** Reservas que ocupan inventario. */
const ACTIVE: ReservationStatus[] = ['CONFIRMED', 'CHECKED_IN'];

// Tolerancia para registrar una estancia que empieza "ahora mismo".
const PAST_TOLERANCE_MS = 30 * 60_000;

const reservationInclude = {
  guest: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      isVip: true,
      isBlocked: true,
    },
  },
  roomType: { select: { id: true, name: true } },
  room: { select: { id: true, number: true } },
  taxProfile: { select: { id: true, rfc: true, legalName: true } },
  createdBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} satisfies Prisma.ReservationInclude;

interface Context {
  timeZone: string;
  settings: StaySettings;
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotel: HotelService,
    private readonly ratePeriods: RatePeriodsService,
  ) {}

  // ---------------------------------------------------------------------
  // Cotizar y disponibilidad
  // ---------------------------------------------------------------------

  /**
   * Para unas fechas y personas: cada tipo activo con su disponibilidad,
   * si cabe la cantidad de personas y el precio calculado.
   */
  async quote(actor: AuthUser, dto: StayDto) {
    const ctx = await this.context(actor);
    const stay = this.stayOrThrow(dto, ctx);
    const guests = { adults: dto.adults, children: dto.children ?? 0 };

    const types = await this.prisma.roomType.findMany({
      where: { hotelId: actor.hotelId, isActive: true },
      orderBy: [{ nightlyRate: 'asc' }, { name: 'asc' }],
    });
    const calendar = await this.priceCalendar(
      actor,
      dto.arrivalDate,
      dto.modality,
      stay.units,
    );

    const results = [];
    for (const type of types) {
      const availability = await this.availability(
        this.prisma,
        actor,
        type.id,
        stay,
        ctx,
      );
      results.push({
        roomType: {
          id: type.id,
          name: type.name,
          maxAdults: type.maxAdults,
          maxChildren: type.maxChildren,
          amenities: type.amenities,
        },
        ...availability,
        fitsGuests: fitsCapacity(type, guests),
        quote: computeQuote(
          type,
          stay,
          dto.modality,
          guests,
          ctx.settings,
          calendar,
        ),
      });
    }
    return {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      units: stay.units,
      options: results,
    };
  }

  /**
   * Habitaciones de un tipo disponibles para una estancia: las vendibles
   * (activas y sin bloqueo en esas fechas) menos el pico de reservas
   * activas que se cruzan.
   */
  private async availability(
    db: Tx | PrismaService,
    actor: AuthUser,
    roomTypeId: string,
    stay: Pick<Stay, 'checkIn' | 'checkOut'>,
    ctx: Context,
    excludeReservationId?: string,
  ) {
    const firstDay = toDbDate(todayIn(ctx.timeZone, stay.checkIn));
    const [sellable, overlapping] = await Promise.all([
      db.room.count({
        where: {
          hotelId: actor.hotelId,
          roomTypeId,
          isActive: true,
          // Bloqueada si su bloqueo llega (o pasa) del día de entrada, o es indefinido.
          NOT: {
            status: { in: ['MAINTENANCE', 'OUT_OF_SERVICE'] },
            OR: [{ blockedUntil: null }, { blockedUntil: { gte: firstDay } }],
          },
        },
      }),
      db.reservation.findMany({
        where: {
          hotelId: actor.hotelId,
          roomTypeId,
          status: { in: ACTIVE },
          checkIn: { lt: stay.checkOut },
          checkOut: { gt: stay.checkIn },
          ...(excludeReservationId && { id: { not: excludeReservationId } }),
        },
        select: { checkIn: true, checkOut: true },
      }),
    ]);
    const booked = peakOccupancy(overlapping, stay.checkIn, stay.checkOut);
    return { sellable, booked, available: Math.max(0, sellable - booked) };
  }

  /**
   * Ocupación por tipo y por día para el calendario: habitaciones vendibles
   * y pico de reservas de cada día, más las reservas del periodo.
   */
  async calendar(actor: AuthUser, query: CalendarQueryDto) {
    const ctx = await this.context(actor);
    const days = Array.from({ length: query.days }, (_, i) =>
      addDaysTo(query.from, i),
    );
    const rangeStart = zonedToUtc(days[0], '00:00', ctx.timeZone);
    const rangeEnd = zonedToUtc(
      addDaysTo(query.from, query.days),
      '00:00',
      ctx.timeZone,
    );

    const [types, reservations] = await Promise.all([
      this.prisma.roomType.findMany({
        where: { hotelId: actor.hotelId, isActive: true },
        include: {
          rooms: {
            where: { isActive: true },
            select: { status: true, blockedUntil: true },
          },
        },
        orderBy: [{ nightlyRate: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.reservation.findMany({
        where: {
          hotelId: actor.hotelId,
          status: { in: ACTIVE },
          checkIn: { lt: rangeEnd },
          checkOut: { gt: rangeStart },
        },
        include: reservationInclude,
        orderBy: { checkIn: 'asc' },
      }),
    ]);

    const rows = types.map((type) => ({
      roomType: { id: type.id, name: type.name },
      total: type.rooms.length,
      days: days.map((day) => {
        const start = zonedToUtc(day, '00:00', ctx.timeZone);
        const end = zonedToUtc(addDaysTo(day, 1), '00:00', ctx.timeZone);
        const dayDate = toDbDate(day);
        const sellable = type.rooms.filter(
          (r) =>
            !(
              (r.status === 'MAINTENANCE' || r.status === 'OUT_OF_SERVICE') &&
              (r.blockedUntil === null || r.blockedUntil >= dayDate)
            ),
        ).length;
        const booked = peakOccupancy(
          reservations.filter((r) => r.roomTypeId === type.id),
          start,
          end,
        );
        return {
          date: day,
          sellable,
          booked,
          available: Math.max(0, sellable - booked),
        };
      }),
    }));

    const pricing = await this.ratePeriods.pricingCalendar(
      actor.hotelId,
      days[0],
      days[days.length - 1],
    );
    return { days, rows, reservations, ...pricing };
  }

  // ---------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------

  async findAll(actor: AuthUser, query: QueryReservationsDto) {
    const ctx = await this.context(actor);
    const search = query.search?.trim();
    const code = search?.toUpperCase().match(/^R?-?0*(\d+)$/);

    const where: Prisma.ReservationWhereInput = {
      hotelId: actor.hotelId,
      status: query.status,
      source: query.source,
      guestId: query.guestId,
      ...((query.from || query.to) && {
        checkIn: {
          ...(query.from && {
            gte: zonedToUtc(query.from, '00:00', ctx.timeZone),
          }),
          ...(query.to && {
            lt: zonedToUtc(addDaysTo(query.to, 1), '00:00', ctx.timeZone),
          }),
        },
      }),
      ...(search &&
        (code
          ? { code: `R-${code[1].padStart(6, '0')}` }
          : {
              guest: {
                AND: searchTerms(search).map((term) => ({
                  searchText: { contains: term },
                })),
              },
            })),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: { checkIn: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
    } satisfies Paginated<unknown>;
  }

  async findOne(actor: AuthUser, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    return reservation;
  }

  // ---------------------------------------------------------------------
  // Crear, modificar, cancelar, no-show
  // ---------------------------------------------------------------------

  async create(actor: AuthUser, dto: CreateReservationDto) {
    const ctx = await this.context(actor);
    const stay = this.stayOrThrow(dto, ctx);
    assertNotPast(dto.modality, dto.arrivalDate, stay, ctx.timeZone);
    const guests = { adults: dto.adults, children: dto.children ?? 0 };

    const [type] = await Promise.all([
      this.activeType(actor, dto.roomTypeId),
      this.assertGuest(actor, dto.guestId, dto.taxProfileId),
    ]);
    assertCapacity(type, guests);
    const calendar = await this.priceCalendar(
      actor,
      dto.arrivalDate,
      dto.modality,
      stay.units,
    );
    const quote = computeQuote(
      type,
      stay,
      dto.modality,
      guests,
      ctx.settings,
      calendar,
    );

    return this.prisma.$transaction(async (tx) => {
      await lockRoomType(tx, type.id);
      const { available } = await this.availability(
        tx,
        actor,
        type.id,
        stay,
        ctx,
      );
      if (available < 1) throw noAvailability(type.name);

      const settings = await tx.hotelSettings.update({
        where: { hotelId: actor.hotelId },
        data: { nextReservationNumber: { increment: 1 } },
      });
      const number = settings.nextReservationNumber - 1;

      return tx.reservation.create({
        data: {
          hotelId: actor.hotelId,
          code: `R-${String(number).padStart(6, '0')}`,
          guestId: dto.guestId,
          roomTypeId: type.id,
          modality: dto.modality,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          units: stay.units,
          adults: guests.adults,
          children: guests.children,
          source: dto.source,
          requiresDeposit: dto.requiresDeposit ?? false,
          notes: dto.notes,
          taxProfileId: dto.taxProfileId,
          nightlyRate: quote.nightlyRate,
          baseAmount: quote.baseAmount,
          extrasAmount: quote.extrasAmount,
          totalAmount: quote.totalAmount,
          pricing: quote.detail as unknown as Prisma.InputJsonValue,
          createdById: actor.id,
        },
        include: reservationInclude,
      });
    });
  }

  /**
   * Modifica una reserva confirmada. Si cambian fechas, tipo o personas,
   * se revalida la disponibilidad y se recalcula el precio.
   */
  async update(actor: AuthUser, id: string, dto: UpdateReservationDto) {
    const current = await this.findOne(actor, id);
    if (current.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Solo se pueden modificar reservas confirmadas',
      );
    }
    const ctx = await this.context(actor);

    const stayChanged =
      dto.modality !== undefined ||
      dto.arrivalDate !== undefined ||
      dto.departureDate !== undefined ||
      dto.arrivalTime !== undefined ||
      dto.units !== undefined;
    const repricing =
      stayChanged ||
      dto.roomTypeId !== undefined ||
      dto.adults !== undefined ||
      dto.children !== undefined;

    const guestId = dto.guestId ?? current.guestId;
    if (dto.guestId !== undefined || dto.taxProfileId) {
      await this.assertGuest(
        actor,
        guestId,
        dto.taxProfileId === undefined
          ? current.taxProfileId
          : dto.taxProfileId,
      );
    }

    const data: Prisma.ReservationUncheckedUpdateInput = {
      guestId,
      source: dto.source,
      requiresDeposit: dto.requiresDeposit,
      notes: dto.notes,
      taxProfileId: dto.taxProfileId,
    };
    // Al cambiar de huésped, los datos fiscales del anterior ya no aplican.
    if (
      dto.guestId &&
      dto.guestId !== current.guestId &&
      dto.taxProfileId === undefined
    ) {
      data.taxProfileId = null;
    }

    if (!repricing) {
      return this.prisma.reservation.update({
        where: { id },
        data,
        include: reservationInclude,
      });
    }

    // Recalcular: se parte de la estancia actual y se aplican los cambios.
    if (stayChanged && !dto.modality) {
      throw new BadRequestException(
        'Para cambiar las fechas indica la modalidad, la llegada y la salida (o la hora y duración)',
      );
    }
    const modality = (dto.modality ?? current.modality) as StayModality;
    const stay = stayChanged
      ? this.stayOrThrow(dto as StayDto, ctx)
      : {
          checkIn: current.checkIn,
          checkOut: current.checkOut,
          units: current.units,
        };
    if (stayChanged) {
      assertNotPast(modality, dto.arrivalDate!, stay, ctx.timeZone);
    }
    const guests = {
      adults: dto.adults ?? current.adults,
      children: dto.children ?? current.children,
    };
    const type = await this.activeType(
      actor,
      dto.roomTypeId ?? current.roomTypeId,
    );
    assertCapacity(type, guests);
    const calendar = await this.priceCalendar(
      actor,
      stayChanged ? dto.arrivalDate! : todayIn(ctx.timeZone, current.checkIn),
      modality,
      stay.units,
    );
    const quote = computeQuote(
      type,
      stay,
      modality,
      guests,
      ctx.settings,
      calendar,
    );

    return this.prisma.$transaction(async (tx) => {
      await lockRoomType(tx, type.id);
      const { available } = await this.availability(
        tx,
        actor,
        type.id,
        stay,
        ctx,
        id,
      );
      if (available < 1) throw noAvailability(type.name);

      return tx.reservation.update({
        where: { id },
        data: {
          ...data,
          roomTypeId: type.id,
          modality,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          units: stay.units,
          adults: guests.adults,
          children: guests.children,
          nightlyRate: quote.nightlyRate,
          baseAmount: quote.baseAmount,
          extrasAmount: quote.extrasAmount,
          totalAmount: quote.totalAmount,
          pricing: quote.detail as unknown as Prisma.InputJsonValue,
        },
        include: reservationInclude,
      });
    });
  }

  async cancel(actor: AuthUser, id: string, reason: string) {
    const current = await this.findOne(actor, id);
    if (current.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Solo se pueden cancelar reservas confirmadas',
      );
    }
    return this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: actor.id,
        cancelReason: reason,
      },
      include: reservationInclude,
    });
  }

  /** El huésped no llegó: libera la disponibilidad. */
  async markNoShow(actor: AuthUser, id: string) {
    const current = await this.findOne(actor, id);
    if (current.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Solo una reserva confirmada puede marcarse como "No se presentó"',
      );
    }
    if (current.checkIn > new Date()) {
      throw new BadRequestException(
        'Aún no llega la hora de entrada; no se puede marcar como "No se presentó"',
      );
    }
    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'NO_SHOW', noShowAt: new Date() },
      include: reservationInclude,
    });
  }

  // ---------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------

  /** Temporadas y ajuste por día que tocan las noches de la estancia. */
  private async priceCalendar(
    actor: AuthUser,
    arrivalDate: string,
    modality: StayModality,
    units: number,
  ): Promise<PriceCalendar> {
    const lastNight =
      modality === 'NIGHTLY' ? addDaysTo(arrivalDate, units - 1) : arrivalDate;
    const { seasons, weekday } = await this.ratePeriods.pricingCalendar(
      actor.hotelId,
      arrivalDate,
      lastNight,
    );
    return { arrivalDate, seasons, weekday };
  }

  private async context(actor: AuthUser): Promise<Context> {
    const [hotel, settings] = await Promise.all([
      this.prisma.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { timezone: true },
      }),
      this.hotel.getSettings(actor.hotelId),
    ]);
    return { timeZone: hotel.timezone, settings };
  }

  private stayOrThrow(dto: StayDto, ctx: Context): Stay {
    try {
      return computeStay(dto, ctx.settings, ctx.timeZone);
    } catch (error) {
      if (error instanceof StayError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async activeType(actor: AuthUser, id: string): Promise<RoomType> {
    const type = await this.prisma.roomType.findFirst({
      where: { id, hotelId: actor.hotelId },
    });
    if (!type) throw new NotFoundException('Tipo de habitación no encontrado');
    if (!type.isActive) {
      throw new BadRequestException('Ese tipo de habitación está desactivado');
    }
    return type;
  }

  private async assertGuest(
    actor: AuthUser,
    guestId: string,
    taxProfileId?: string | null,
  ) {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, hotelId: actor.hotelId },
      select: { isBlocked: true, taxProfiles: { select: { id: true } } },
    });
    if (!guest) throw new NotFoundException('Huésped no encontrado');
    if (guest.isBlocked) {
      throw new BadRequestException(
        'El huésped está bloqueado; no se le pueden hacer reservas',
      );
    }
    if (taxProfileId && !guest.taxProfiles.some((p) => p.id === taxProfileId)) {
      throw new BadRequestException(
        'Los datos fiscales no pertenecen a este huésped',
      );
    }
  }
}

// -------------------------------------------------------------------------

/**
 * Candado por tipo de habitación durante la transacción: dos ventas
 * simultáneas del mismo tipo se atienden una por una, así nunca se vende
 * más de lo disponible.
 */
async function lockRoomType(tx: Tx, roomTypeId: string) {
  // executeRaw: la función devuelve void y no hay nada que leer.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${roomTypeId}, 0))`;
}

function fitsCapacity(
  type: Pick<RoomType, 'maxAdults' | 'maxChildren'>,
  guests: { adults: number; children: number },
) {
  return guests.adults <= type.maxAdults && guests.children <= type.maxChildren;
}

function assertCapacity(
  type: Pick<RoomType, 'name' | 'maxAdults' | 'maxChildren'>,
  guests: { adults: number; children: number },
) {
  if (!fitsCapacity(type, guests)) {
    throw new BadRequestException(
      `«${type.name}» admite hasta ${type.maxAdults} adultos y ${type.maxChildren} niños`,
    );
  }
}

function assertNotPast(
  modality: StayModality,
  arrivalDate: string,
  stay: Pick<Stay, 'checkIn'>,
  timeZone: string,
) {
  const past =
    modality === 'NIGHTLY'
      ? arrivalDate < todayIn(timeZone)
      : stay.checkIn.getTime() < Date.now() - PAST_TOLERANCE_MS;
  if (past) throw new BadRequestException('No se puede reservar en el pasado');
}

function noAvailability(typeName: string) {
  return new ConflictException(
    `No hay habitaciones «${typeName}» disponibles en esas fechas`,
  );
}
