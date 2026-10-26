import { Injectable } from '@nestjs/common';
import type { RoomStatus } from '../../generated/prisma/enums.js';
import {
  addDaysTo,
  isBlockOverdue,
  todayIn,
  toDbDate,
  zonedToUtc,
} from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BillingService } from '../billing/billing.service.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import { StaysService } from '../reservations/stays.service.js';

const FORECAST_DAYS = 14;
const LONG_SHIFT_HOURS = 12;

export interface DashboardAlert {
  kind: string;
  severity: 'warning' | 'danger' | 'info';
  text: string;
  /** Ruta del frontend a la que lleva el aviso. */
  link?: string;
}

/** Tablero de Inicio: el día en un vistazo. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly stays: StaysService,
    private readonly billing: BillingService,
  ) {}

  async get(actor: AuthUser) {
    const { timeZone } = await this.reservations.context(actor);
    const today = todayIn(timeZone);
    const rooms = await this.rooms(actor, timeZone, today);

    // Limpieza: solo habitaciones, sin dinero ni huéspedes.
    if (actor.role === 'HOUSEKEEPING') {
      const cleanedToday = await this.prisma.roomStatusLog.count({
        where: {
          hotelId: actor.hotelId,
          cleanedById: actor.id,
          cleanedAt: { gte: zonedToUtc(today, '00:00', timeZone) },
        },
      });
      return { today, rooms, cleanedToday };
    }

    const [desk, forecast, money, alerts] = await Promise.all([
      this.stays.frontDesk(actor),
      this.forecast(actor, today),
      this.money(actor, today, timeZone),
      this.alerts(actor, today, timeZone),
    ]);
    const departures = desk.inHouse.filter((r) => r.departsToday || r.overdue);
    const overdue = desk.inHouse.filter((r) => r.overdue);
    if (overdue.length) {
      alerts.unshift({
        kind: 'overdue-departures',
        severity: 'danger',
        text: `${overdue.length} salida(s) vencida(s) sin check-out`,
        link: '/recepcion',
      });
    }

    const occupied = rooms.byStatus.OCCUPIED;
    return {
      today,
      rooms,
      occupancy: {
        occupied,
        sellable: rooms.sellable,
        percent: rooms.sellable
          ? Math.round((occupied / rooms.sellable) * 1000) / 10
          : 0,
      },
      frontDesk: {
        arrivals: desk.arrivals.length,
        departures: departures.length,
        overdue: overdue.length,
        inHouse: desk.inHouse.length,
        guests: desk.inHouse.reduce((n, r) => n + r.adults + r.children, 0),
      },
      money,
      forecast,
      alerts,
    };
  }

  /** Conteo por estado y habitaciones por limpiar. */
  private async rooms(actor: AuthUser, timeZone: string, today: string) {
    const rows = await this.prisma.room.findMany({
      where: { hotelId: actor.hotelId, isActive: true },
      select: {
        id: true,
        number: true,
        floor: true,
        status: true,
        blockedUntil: true,
        updatedAt: true,
        roomType: { select: { name: true } },
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
    const byStatus: Record<RoomStatus, number> = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      CLEANING: 0,
      MAINTENANCE: 0,
      OUT_OF_SERVICE: 0,
    };
    for (const r of rows) byStatus[r.status]++;
    const todayDate = toDbDate(today);
    const blockedToday = rows.filter(
      (r) =>
        (r.status === 'MAINTENANCE' || r.status === 'OUT_OF_SERVICE') &&
        (r.blockedUntil === null || r.blockedUntil >= todayDate),
    ).length;
    return {
      total: rows.length,
      sellable: rows.length - blockedToday,
      byStatus,
      toClean: rows
        .filter((r) => r.status === 'CLEANING')
        .map((r) => ({
          id: r.id,
          number: r.number,
          floor: r.floor,
          roomType: r.roomType.name,
          since: r.updatedAt,
        })),
      overdueBlocks: rows.filter(
        (r) =>
          (r.status === 'MAINTENANCE' || r.status === 'OUT_OF_SERVICE') &&
          isBlockOverdue(r.blockedUntil, timeZone),
      ).length,
    };
  }

  /** Ocupación prevista (reservas confirmadas y en casa) por día. */
  private async forecast(actor: AuthUser, today: string) {
    const calendar = await this.reservations.calendar(actor, {
      from: today,
      days: FORECAST_DAYS,
    });
    return calendar.days.map((date, i) => {
      const sellable = calendar.rows.reduce(
        (n, r) => n + r.days[i].sellable,
        0,
      );
      const booked = calendar.rows.reduce((n, r) => n + r.days[i].booked, 0);
      return {
        date,
        sellable,
        booked,
        percent: sellable ? Math.round((booked / sellable) * 1000) / 10 : 0,
      };
    });
  }

  /** Cobrado hoy (neto, en pesos) y cuentas por cobrar. */
  private async money(actor: AuthUser, today: string, timeZone: string) {
    const start = zonedToUtc(today, '00:00', timeZone);
    const end = zonedToUtc(addDaysTo(today, 1), '00:00', timeZone);
    const [paid, receivables] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['kind'],
        where: {
          hotelId: actor.hotelId,
          voidedAt: null,
          createdAt: { gte: start, lt: end },
        },
        _sum: { amountMxnCents: true },
      }),
      this.billing.receivables(actor),
    ]);
    const sum = (kind: 'PAYMENT' | 'REFUND') =>
      paid.find((p) => p.kind === kind)?._sum.amountMxnCents ?? 0;
    return {
      collectedTodayCents: sum('PAYMENT') - sum('REFUND'),
      receivablesCents: receivables.reduce((n, r) => n + r.balanceCents, 0),
      receivablesCount: receivables.length,
    };
  }

  private async alerts(
    actor: AuthUser,
    today: string,
    timeZone: string,
  ): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];
    const tomorrowEnd = zonedToUtc(addDaysTo(today, 2), '00:00', timeZone);
    const longAgo = new Date(Date.now() - LONG_SHIFT_HOURS * 3_600_000);

    const [noDeposit, longShifts, rate] = await Promise.all([
      this.prisma.reservation.count({
        where: {
          hotelId: actor.hotelId,
          status: 'CONFIRMED',
          requiresDeposit: true,
          checkIn: { lt: tomorrowEnd },
          checkOut: { gt: new Date() },
          payments: { none: { kind: 'PAYMENT', voidedAt: null } },
        },
      }),
      this.prisma.cashShift.findMany({
        where: {
          hotelId: actor.hotelId,
          closedAt: null,
          openedAt: { lt: longAgo },
          // Recepción solo ve el suyo.
          ...(actor.role !== 'ADMIN' && { userId: actor.id }),
        },
        select: { user: { select: { name: true } } },
      }),
      this.billing.todayRate(actor),
    ]);

    if (noDeposit) {
      alerts.push({
        kind: 'no-deposit',
        severity: 'warning',
        text: `${noDeposit} reserva(s) que llegan hoy o mañana aún sin anticipo`,
        link: '/reservas/lista',
      });
    }
    for (const s of longShifts) {
      alerts.push({
        kind: 'long-shift',
        severity: 'warning',
        text: `El turno de caja de ${s.user.name} lleva más de ${LONG_SHIFT_HOURS} h abierto`,
        link: actor.role === 'ADMIN' ? '/caja/cortes' : '/caja',
      });
    }
    if (rate.rate === null) {
      alerts.push({
        kind: 'no-rate',
        severity: 'info',
        text: 'Aún no se captura el tipo de cambio de hoy',
      });
    }
    return alerts;
  }
}
