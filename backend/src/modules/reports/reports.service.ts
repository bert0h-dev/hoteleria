import { BadRequestException, Injectable } from '@nestjs/common';
import {
  addDaysTo,
  daysBetween,
  todayIn,
  zonedToUtc,
} from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  pct,
  sumRows,
  type Report,
  type ReportKind,
  type ReportRow,
} from './report.types.js';

const MAX_DAYS = 366;

const SOURCES: Record<string, string> = {
  WALK_IN: 'Mostrador',
  PHONE: 'Teléfono',
  WHATSAPP: 'WhatsApp',
  OTHER: 'Otro',
};
const METHODS: Record<string, string> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Tarjeta de débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};
const STATUSES: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'En casa',
  CHECKED_OUT: 'Salió',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No se presentó',
};
const MODALITIES: Record<string, string> = {
  NIGHTLY: 'Por noche',
  DAILY: 'Por día',
  HOURLY: 'Por horas',
};

/** Reservas que ocupan (o van a ocupar) una habitación. */
const STAYED = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const;

interface Range {
  from: string;
  to: string;
  days: string[];
  start: Date;
  end: Date;
  timeZone: string;
}

const guestName = (g: { firstName: string; lastName: string }) =>
  `${g.firstName} ${g.lastName}`;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    actor: AuthUser,
    kind: ReportKind,
    from: string,
    to: string,
  ): Promise<Report> {
    const range = await this.range(actor, from, to);
    switch (kind) {
      case 'occupancy':
        return this.occupancy(actor, range);
      case 'revenue':
        return this.revenue(actor, range);
      case 'payments':
        return this.payments(actor, range);
      case 'discounts':
        return this.discounts(actor, range);
      case 'reservations':
        return this.reservations(actor, range);
      case 'rentals':
        return this.rentals(actor, range);
      case 'housekeeping':
        return this.housekeeping(actor, range);
    }
  }

  private async range(actor: AuthUser, from: string, to: string) {
    if (to < from) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la inicial',
      );
    }
    const count = daysBetween(from, to) + 1;
    if (count > MAX_DAYS) {
      throw new BadRequestException(
        `El rango no puede pasar de ${MAX_DAYS} días`,
      );
    }
    const { timezone: timeZone } = await this.prisma.hotel.findUniqueOrThrow({
      where: { id: actor.hotelId },
      select: { timezone: true },
    });
    return {
      from,
      to,
      days: Array.from({ length: count }, (_, i) => addDaysTo(from, i)),
      start: zonedToUtc(from, '00:00', timeZone),
      end: zonedToUtc(addDaysTo(to, 1), '00:00', timeZone),
      timeZone,
    } satisfies Range;
  }

  /**
   * Noches que ocupa una estancia: cuenta el día D si la reserva está en
   * curso a las 23:00 de D. Las estancias por día u horas que no cruzan esa
   * hora no suman noches.
   */
  private nightsOf(
    r: { checkIn: Date; checkOut: Date },
    timeZone: string,
  ): string[] {
    const nights: string[] = [];
    let day = todayIn(timeZone, r.checkIn);
    const last = todayIn(timeZone, r.checkOut);
    while (day <= last) {
      const anchor = zonedToUtc(day, '23:00', timeZone);
      if (r.checkIn <= anchor && anchor < r.checkOut) nights.push(day);
      day = addDaysTo(day, 1);
    }
    return nights;
  }

  /** Estancias del rango con su hospedaje repartido por día. */
  private async accruedStays(actor: AuthUser, range: Range) {
    const rows = await this.prisma.reservation.findMany({
      where: {
        hotelId: actor.hotelId,
        status: { in: [...STAYED] },
        checkIn: { lt: range.end },
        checkOut: { gt: range.start },
      },
      select: {
        id: true,
        modality: true,
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        source: true,
        roomType: { select: { name: true } },
      },
    });
    return rows.map((r) => {
      const nights = this.nightsOf(r, range.timeZone);
      const totalCents = r.totalAmount * 100;
      // Por noche: el total se reparte entre sus noches. Por día u horas:
      // todo el día de entrada.
      const perDay = new Map<string, number>();
      if (r.modality === 'NIGHTLY' && nights.length) {
        const each = Math.floor(totalCents / nights.length);
        nights.forEach((d, i) =>
          perDay.set(
            d,
            each + (i === 0 ? totalCents - each * nights.length : 0),
          ),
        );
      } else {
        perDay.set(todayIn(range.timeZone, r.checkIn), totalCents);
      }
      return { ...r, nights, perDay };
    });
  }

  // -------------------------------------------------------------------------

  private async occupancy(actor: AuthUser, range: Range): Promise<Report> {
    const [stays, roomCount] = await Promise.all([
      this.accruedStays(actor, range),
      this.prisma.room.count({
        where: { hotelId: actor.hotelId, isActive: true },
      }),
    ]);
    const rows: ReportRow[] = range.days.map((date) => {
      const sold = stays.filter((s) => s.nights.includes(date)).length;
      const revenue = stays.reduce(
        (n, s) => n + (s.nights.includes(date) ? (s.perDay.get(date) ?? 0) : 0),
        0,
      );
      return {
        date,
        available: roomCount,
        sold,
        occupancy: pct(sold, roomCount),
        revenue,
        adr: sold ? Math.round(revenue / sold) : 0,
        revpar: roomCount ? Math.round(revenue / roomCount) : 0,
      };
    });
    const totals = sumRows(rows, ['available', 'sold', 'revenue']);
    const sold = Number(totals.sold);
    const available = Number(totals.available);
    const revenue = Number(totals.revenue);
    totals.occupancy = pct(sold, available);
    totals.adr = sold ? Math.round(revenue / sold) : 0;
    totals.revpar = available ? Math.round(revenue / available) : 0;

    const byType = new Map<string, { sold: number; revenue: number }>();
    for (const s of stays) {
      const row = byType.get(s.roomType.name) ?? { sold: 0, revenue: 0 };
      for (const d of s.nights) {
        if (d < range.from || d > range.to) continue;
        row.sold++;
        row.revenue += s.perDay.get(d) ?? 0;
      }
      byType.set(s.roomType.name, row);
    }
    const typeRows: ReportRow[] = [...byType]
      .filter(([, v]) => v.sold > 0)
      .map(([name, v]) => ({
        name,
        sold: v.sold,
        share: pct(v.sold, sold),
        revenue: v.revenue,
        adr: Math.round(v.revenue / v.sold),
      }));

    return {
      kind: 'occupancy',
      title: 'Ocupación',
      from: range.from,
      to: range.to,
      notes:
        'Cuenta una noche si la habitación está ocupada a las 23:00. Incluye reservas confirmadas futuras. ADR = ingreso de hospedaje / noches vendidas; RevPAR = ingreso / habitaciones disponibles.',
      summary: [
        {
          label: 'Ocupación promedio',
          value: Number(totals.occupancy),
          type: 'percent',
        },
        { label: 'Noches vendidas', value: sold, type: 'int' },
        { label: 'ADR', value: Number(totals.adr), type: 'money' },
        { label: 'RevPAR', value: Number(totals.revpar), type: 'money' },
      ],
      sections: [
        {
          title: 'Por día',
          columns: [
            { key: 'date', label: 'Día', type: 'date' },
            { key: 'available', label: 'Disponibles', type: 'int' },
            { key: 'sold', label: 'Vendidas', type: 'int' },
            { key: 'occupancy', label: 'Ocupación', type: 'percent' },
            { key: 'revenue', label: 'Hospedaje', type: 'money' },
            { key: 'adr', label: 'ADR', type: 'money' },
            { key: 'revpar', label: 'RevPAR', type: 'money' },
          ],
          rows,
          totals,
        },
        {
          title: 'Por tipo de habitación',
          columns: [
            { key: 'name', label: 'Tipo', type: 'text' },
            { key: 'sold', label: 'Noches', type: 'int' },
            { key: 'share', label: '% de noches', type: 'percent' },
            { key: 'revenue', label: 'Hospedaje', type: 'money' },
            { key: 'adr', label: 'ADR', type: 'money' },
          ],
          rows: typeRows,
          totals: sumRows(typeRows, ['sold', 'revenue']),
        },
      ],
    };
  }

  private async revenue(actor: AuthUser, range: Range): Promise<Report> {
    const [stays, entries] = await Promise.all([
      this.accruedStays(actor, range),
      this.prisma.folioCharge.findMany({
        where: {
          hotelId: actor.hotelId,
          voidedAt: null,
          createdAt: { gte: range.start, lt: range.end },
        },
        select: {
          kind: true,
          amountCents: true,
          createdAt: true,
          reservation: {
            select: { source: true, roomType: { select: { name: true } } },
          },
        },
      }),
    ]);
    const inRange = (d: string) => d >= range.from && d <= range.to;
    const local = (d: Date) => todayIn(range.timeZone, d);

    const rows: ReportRow[] = range.days.map((date) => {
      const lodging = stays.reduce((n, s) => n + (s.perDay.get(date) ?? 0), 0);
      const dayEntries = entries.filter((e) => local(e.createdAt) === date);
      const extras = dayEntries
        .filter((e) => e.kind === 'CHARGE')
        .reduce((n, e) => n + e.amountCents, 0);
      const discounts = dayEntries
        .filter((e) => e.kind === 'DISCOUNT')
        .reduce((n, e) => n + e.amountCents, 0);
      return {
        date,
        lodging,
        extras,
        discounts,
        net: lodging + extras - discounts,
      };
    });
    const keys = ['lodging', 'extras', 'discounts', 'net'];
    const totals = sumRows(rows, keys);

    // Por tipo y por origen (hospedaje + extras − descuentos).
    const group = (pick: (s: (typeof stays)[number]) => string) => {
      const map = new Map<string, ReportRow>();
      const add = (name: string, key: string, cents: number) => {
        const row = map.get(name) ?? {
          name,
          lodging: 0,
          extras: 0,
          discounts: 0,
          net: 0,
        };
        row[key] = Number(row[key]) + cents;
        row.net =
          Number(row.lodging) + Number(row.extras) - Number(row.discounts);
        map.set(name, row);
      };
      for (const s of stays) {
        for (const [d, cents] of s.perDay) {
          if (inRange(d)) add(pick(s), 'lodging', cents);
        }
      }
      return { map, add };
    };
    const byType = group((s) => s.roomType.name);
    const bySource = group((s) => SOURCES[s.source]);
    for (const e of entries) {
      const key = e.kind === 'CHARGE' ? 'extras' : 'discounts';
      byType.add(e.reservation.roomType.name, key, e.amountCents);
      bySource.add(SOURCES[e.reservation.source], key, e.amountCents);
    }
    const columns = [
      { key: 'lodging', label: 'Hospedaje', type: 'money' as const },
      { key: 'extras', label: 'Extras', type: 'money' as const },
      { key: 'discounts', label: 'Descuentos', type: 'money' as const },
      { key: 'net', label: 'Neto', type: 'money' as const },
    ];
    const typeRows = [...byType.map.values()];
    const sourceRows = [...bySource.map.values()];

    return {
      kind: 'revenue',
      title: 'Ingresos (devengado)',
      from: range.from,
      to: range.to,
      notes:
        'Hospedaje repartido por noche de estancia (por día u horas: el día de entrada); extras y descuentos por fecha de registro. Precios con IVA e ISH incluidos. Para lo cobrado, usa el reporte de Cobros.',
      summary: [
        { label: 'Hospedaje', value: Number(totals.lodging), type: 'money' },
        { label: 'Extras', value: Number(totals.extras), type: 'money' },
        { label: 'Descuentos', value: Number(totals.discounts), type: 'money' },
        { label: 'Neto', value: Number(totals.net), type: 'money' },
      ],
      sections: [
        {
          title: 'Por día',
          columns: [{ key: 'date', label: 'Día', type: 'date' }, ...columns],
          rows,
          totals,
        },
        {
          title: 'Por tipo de habitación',
          columns: [{ key: 'name', label: 'Tipo', type: 'text' }, ...columns],
          rows: typeRows,
          totals: sumRows(typeRows, keys),
        },
        {
          title: 'Por origen de la reserva',
          columns: [{ key: 'name', label: 'Origen', type: 'text' }, ...columns],
          rows: sourceRows,
          totals: sumRows(sourceRows, keys),
        },
      ],
    };
  }

  private async payments(actor: AuthUser, range: Range): Promise<Report> {
    const payments = await this.prisma.payment.findMany({
      where: {
        hotelId: actor.hotelId,
        createdAt: { gte: range.start, lt: range.end },
      },
      include: {
        createdBy: { select: { name: true } },
        voidedBy: { select: { name: true } },
        reservation: {
          select: {
            code: true,
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const valid = payments.filter((p) => !p.voidedAt);
    const sign = (p: { kind: string }) => (p.kind === 'REFUND' ? -1 : 1);

    const byMethod = new Map<string, ReportRow>();
    for (const p of valid) {
      const key = `${p.method}:${p.currency}`;
      const row = byMethod.get(key) ?? {
        name: `${METHODS[p.method]}${p.currency === 'USD' ? ' (dólares)' : ''}`,
        count: 0,
        usd: null,
        mxn: 0,
      };
      row.count = Number(row.count) + 1;
      if (p.currency === 'USD') {
        row.usd = Number(row.usd) + sign(p) * p.amountCents;
      }
      row.mxn = Number(row.mxn) + sign(p) * p.amountMxnCents;
      byMethod.set(key, row);
    }
    const byUser = new Map<string, ReportRow>();
    for (const p of valid) {
      const row = byUser.get(p.createdBy.name) ?? {
        name: p.createdBy.name,
        payments: 0,
        refunds: 0,
        mxn: 0,
      };
      if (p.kind === 'REFUND') row.refunds = Number(row.refunds) + 1;
      else row.payments = Number(row.payments) + 1;
      row.mxn = Number(row.mxn) + sign(p) * p.amountMxnCents;
      byUser.set(p.createdBy.name, row);
    }
    const methodRows = [...byMethod.values()];
    const userRows = [...byUser.values()];
    const net = valid.reduce((n, p) => n + sign(p) * p.amountMxnCents, 0);
    const voided = payments.filter((p) => p.voidedAt);

    const detail = (p: (typeof payments)[number]): ReportRow => ({
      receipt: p.receiptNumber,
      at: p.createdAt.toISOString(),
      reservation: p.reservation.code,
      guest: guestName(p.reservation.guest),
      kind: p.kind === 'REFUND' ? 'Devolución' : 'Pago',
      method: METHODS[p.method],
      currency: p.currency,
      amount: p.amountCents,
      mxn: sign(p) * p.amountMxnCents,
      user: p.createdBy.name,
    });

    return {
      kind: 'payments',
      title: 'Cobros',
      from: range.from,
      to: range.to,
      notes:
        'Pagos y devoluciones por fecha de cobro. Los montos en dólares se convierten con el tipo de cambio del día del cobro.',
      summary: [
        { label: 'Cobrado neto', value: net, type: 'money' },
        {
          label: 'Pagos',
          value: valid.filter((p) => p.kind === 'PAYMENT').length,
          type: 'int',
        },
        {
          label: 'Devoluciones',
          value: valid.filter((p) => p.kind === 'REFUND').length,
          type: 'int',
        },
        { label: 'Recibos cancelados', value: voided.length, type: 'int' },
      ],
      sections: [
        {
          title: 'Por método y moneda',
          columns: [
            { key: 'name', label: 'Método', type: 'text' },
            { key: 'count', label: 'Movimientos', type: 'int' },
            { key: 'usd', label: 'Dólares', type: 'usd' },
            { key: 'mxn', label: 'Neto en pesos', type: 'money' },
          ],
          rows: methodRows,
          totals: sumRows(methodRows, ['count', 'mxn']),
        },
        {
          title: 'Por usuario',
          columns: [
            { key: 'name', label: 'Usuario', type: 'text' },
            { key: 'payments', label: 'Pagos', type: 'int' },
            { key: 'refunds', label: 'Devoluciones', type: 'int' },
            { key: 'mxn', label: 'Neto en pesos', type: 'money' },
          ],
          rows: userRows,
          totals: sumRows(userRows, ['payments', 'refunds', 'mxn']),
        },
        {
          title: 'Detalle',
          columns: [
            { key: 'receipt', label: 'Recibo', type: 'text' },
            { key: 'at', label: 'Fecha', type: 'datetime' },
            { key: 'reservation', label: 'Reserva', type: 'text' },
            { key: 'guest', label: 'Huésped', type: 'text' },
            { key: 'kind', label: 'Tipo', type: 'text' },
            { key: 'method', label: 'Método', type: 'text' },
            { key: 'currency', label: 'Moneda', type: 'text' },
            { key: 'mxn', label: 'Pesos', type: 'money' },
            { key: 'user', label: 'Cobró', type: 'text' },
          ],
          rows: valid.map(detail),
          totals: { mxn: net },
        },
        {
          title: 'Recibos cancelados',
          columns: [
            { key: 'receipt', label: 'Recibo', type: 'text' },
            { key: 'at', label: 'Fecha', type: 'datetime' },
            { key: 'reservation', label: 'Reserva', type: 'text' },
            { key: 'mxn', label: 'Pesos', type: 'money' },
            { key: 'user', label: 'Cobró', type: 'text' },
            { key: 'voidedBy', label: 'Canceló', type: 'text' },
            { key: 'reason', label: 'Motivo', type: 'text' },
          ],
          rows: voided.map((p) => ({
            ...detail(p),
            voidedBy: p.voidedBy?.name ?? null,
            reason: p.voidReason,
          })),
        },
      ],
    };
  }

  private async discounts(actor: AuthUser, range: Range): Promise<Report> {
    const [discounts, waived] = await Promise.all([
      this.prisma.folioCharge.findMany({
        where: {
          hotelId: actor.hotelId,
          kind: 'DISCOUNT',
          voidedAt: null,
          createdAt: { gte: range.start, lt: range.end },
        },
        include: {
          createdBy: { select: { name: true } },
          authorizedBy: { select: { name: true } },
          reservation: {
            select: {
              code: true,
              guest: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.stayCharge.findMany({
        where: {
          hotelId: actor.hotelId,
          status: 'WAIVED',
          resolvedAt: { gte: range.start, lt: range.end },
        },
        include: {
          resolvedBy: { select: { name: true } },
          authorizedBy: { select: { name: true } },
          reservation: {
            select: {
              code: true,
              guest: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { resolvedAt: 'asc' },
      }),
    ]);
    const rows: ReportRow[] = [
      ...discounts.map((d) => ({
        at: d.createdAt.toISOString(),
        type: 'Descuento',
        reservation: d.reservation.code,
        guest: guestName(d.reservation.guest),
        amount: d.amountCents,
        user: d.createdBy.name,
        authorizedBy: d.authorizedBy?.name ?? null,
        reason: d.reason,
      })),
      ...waived.map((w) => ({
        at: w.resolvedAt!.toISOString(),
        type: `Condonación: ${w.description}`,
        reservation: w.reservation.code,
        guest: guestName(w.reservation.guest),
        amount: w.amount * 100,
        user: w.resolvedBy?.name ?? null,
        authorizedBy: w.authorizedBy?.name ?? null,
        reason: w.waiveReason,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const byUser = new Map<string, ReportRow>();
    for (const r of rows) {
      const name = String(r.user ?? '—');
      const row = byUser.get(name) ?? {
        name,
        count: 0,
        amount: 0,
        authorized: 0,
      };
      row.count = Number(row.count) + 1;
      row.amount = Number(row.amount) + Number(r.amount);
      if (r.authorizedBy) row.authorized = Number(row.authorized) + 1;
      byUser.set(name, row);
    }
    const userRows = [...byUser.values()];
    const total = rows.reduce((n, r) => n + Number(r.amount), 0);

    return {
      kind: 'discounts',
      title: 'Descuentos y condonaciones',
      from: range.from,
      to: range.to,
      summary: [
        { label: 'Total', value: total, type: 'money' },
        { label: 'Descuentos', value: discounts.length, type: 'int' },
        { label: 'Condonaciones', value: waived.length, type: 'int' },
        {
          label: 'Con autorización',
          value: rows.filter((r) => r.authorizedBy).length,
          type: 'int',
        },
      ],
      sections: [
        {
          title: 'Por usuario',
          columns: [
            { key: 'name', label: 'Usuario', type: 'text' },
            { key: 'count', label: 'Movimientos', type: 'int' },
            { key: 'authorized', label: 'Con autorización', type: 'int' },
            { key: 'amount', label: 'Monto', type: 'money' },
          ],
          rows: userRows,
          totals: sumRows(userRows, ['count', 'authorized', 'amount']),
        },
        {
          title: 'Detalle',
          columns: [
            { key: 'at', label: 'Fecha', type: 'datetime' },
            { key: 'type', label: 'Tipo', type: 'text' },
            { key: 'reservation', label: 'Reserva', type: 'text' },
            { key: 'guest', label: 'Huésped', type: 'text' },
            { key: 'amount', label: 'Monto', type: 'money' },
            { key: 'user', label: 'Aplicó', type: 'text' },
            { key: 'authorizedBy', label: 'Autorizó', type: 'text' },
            { key: 'reason', label: 'Motivo', type: 'text' },
          ],
          rows,
          totals: { amount: total },
        },
      ],
    };
  }

  private async reservations(actor: AuthUser, range: Range): Promise<Report> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        hotelId: actor.hotelId,
        createdAt: { gte: range.start, lt: range.end },
      },
      select: {
        status: true,
        source: true,
        modality: true,
        units: true,
        checkIn: true,
        createdAt: true,
      },
    });
    const total = rows.length;
    const count = (pred: (r: (typeof rows)[number]) => boolean) =>
      rows.filter(pred).length;
    const cancelled = count((r) => r.status === 'CANCELLED');
    const noShow = count((r) => r.status === 'NO_SHOW');
    const nightly = rows.filter(
      (r) => r.modality === 'NIGHTLY' && r.status !== 'CANCELLED',
    );
    const avgNights = nightly.length
      ? Math.round(
          (nightly.reduce((n, r) => n + r.units, 0) / nightly.length) * 10,
        ) / 10
      : 0;
    const leadDays = rows.map((r) =>
      Math.max(
        0,
        daysBetween(
          todayIn(range.timeZone, r.createdAt),
          todayIn(range.timeZone, r.checkIn),
        ),
      ),
    );
    const avgLead = total
      ? Math.round((leadDays.reduce((n, d) => n + d, 0) / total) * 10) / 10
      : 0;

    const breakdown = (
      labels: Record<string, string>,
      pick: (r: (typeof rows)[number]) => string,
    ) =>
      Object.entries(labels)
        .map(([key, name]) => {
          const n = count((r) => pick(r) === key);
          return { name, count: n, share: pct(n, total) };
        })
        .filter((r) => r.count > 0);

    return {
      kind: 'reservations',
      title: 'Reservas',
      from: range.from,
      to: range.to,
      notes:
        'Reservas creadas en el rango (por fecha de captura). La estancia promedio solo considera reservas por noche no canceladas.',
      summary: [
        { label: 'Reservas', value: total, type: 'int' },
        { label: 'Canceladas', value: pct(cancelled, total), type: 'percent' },
        {
          label: 'No se presentaron',
          value: pct(noShow, total),
          type: 'percent',
        },
        { label: 'Anticipación promedio (días)', value: avgLead, type: 'int' },
      ],
      sections: [
        {
          title: 'Indicadores',
          columns: [
            { key: 'name', label: 'Indicador', type: 'text' },
            { key: 'value', label: 'Valor', type: 'text' },
          ],
          rows: [
            { name: 'Reservas creadas', value: String(total) },
            {
              name: 'Canceladas',
              value: `${cancelled} (${pct(cancelled, total)} %)`,
            },
            {
              name: 'No se presentaron',
              value: `${noShow} (${pct(noShow, total)} %)`,
            },
            { name: 'Estancia promedio (noches)', value: String(avgNights) },
            { name: 'Anticipación promedio (días)', value: String(avgLead) },
          ],
        },
        {
          title: 'Por estado',
          columns: [
            { key: 'name', label: 'Estado', type: 'text' },
            { key: 'count', label: 'Reservas', type: 'int' },
            { key: 'share', label: '%', type: 'percent' },
          ],
          rows: breakdown(STATUSES, (r) => r.status),
          totals: { count: total },
        },
        {
          title: 'Por origen',
          columns: [
            { key: 'name', label: 'Origen', type: 'text' },
            { key: 'count', label: 'Reservas', type: 'int' },
            { key: 'share', label: '%', type: 'percent' },
          ],
          rows: breakdown(SOURCES, (r) => r.source),
          totals: { count: total },
        },
        {
          title: 'Por modalidad',
          columns: [
            { key: 'name', label: 'Modalidad', type: 'text' },
            { key: 'count', label: 'Reservas', type: 'int' },
            { key: 'share', label: '%', type: 'percent' },
          ],
          rows: breakdown(MODALITIES, (r) => r.modality),
          totals: { count: total },
        },
      ],
    };
  }

  /** Habitaciones rentadas (check-ins) por recepcionista. */
  private async rentals(actor: AuthUser, range: Range): Promise<Report> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        hotelId: actor.hotelId,
        checkedInAt: { gte: range.start, lt: range.end },
        checkedInById: { not: null },
      },
      select: {
        code: true,
        source: true,
        modality: true,
        units: true,
        totalAmount: true,
        checkedInAt: true,
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true } },
        checkedInBy: { select: { name: true } },
      },
      orderBy: { checkedInAt: 'asc' },
    });
    const byUser = new Map<string, ReportRow>();
    for (const r of rows) {
      const name = r.checkedInBy!.name;
      const row = byUser.get(name) ?? {
        name,
        rentals: 0,
        walkIns: 0,
        nights: 0,
        amount: 0,
      };
      row.rentals = Number(row.rentals) + 1;
      if (r.source === 'WALK_IN') row.walkIns = Number(row.walkIns) + 1;
      if (r.modality === 'NIGHTLY') row.nights = Number(row.nights) + r.units;
      row.amount = Number(row.amount) + r.totalAmount * 100;
      byUser.set(name, row);
    }
    const userRows = [...byUser.values()].sort(
      (a, b) => Number(b.rentals) - Number(a.rentals),
    );
    const totals = sumRows(userRows, [
      'rentals',
      'walkIns',
      'nights',
      'amount',
    ]);

    return {
      kind: 'rentals',
      title: 'Habitaciones rentadas por recepcionista',
      from: range.from,
      to: range.to,
      notes: 'Cuenta los check-ins hechos en el rango por cada usuario.',
      summary: [
        { label: 'Rentas', value: Number(totals.rentals), type: 'int' },
        { label: 'Sin reserva', value: Number(totals.walkIns), type: 'int' },
        { label: 'Noches', value: Number(totals.nights), type: 'int' },
        { label: 'Hospedaje', value: Number(totals.amount), type: 'money' },
      ],
      sections: [
        {
          title: 'Por recepcionista',
          columns: [
            { key: 'name', label: 'Recepcionista', type: 'text' },
            { key: 'rentals', label: 'Rentas', type: 'int' },
            { key: 'walkIns', label: 'Sin reserva', type: 'int' },
            { key: 'nights', label: 'Noches', type: 'int' },
            { key: 'amount', label: 'Hospedaje', type: 'money' },
          ],
          rows: userRows,
          totals,
        },
        {
          title: 'Detalle',
          columns: [
            { key: 'at', label: 'Check-in', type: 'datetime' },
            { key: 'user', label: 'Recepcionista', type: 'text' },
            { key: 'reservation', label: 'Reserva', type: 'text' },
            { key: 'guest', label: 'Huésped', type: 'text' },
            { key: 'room', label: 'Habitación', type: 'text' },
            { key: 'stay', label: 'Estancia', type: 'text' },
            { key: 'source', label: 'Origen', type: 'text' },
            { key: 'amount', label: 'Hospedaje', type: 'money' },
          ],
          rows: rows.map((r) => ({
            at: r.checkedInAt!.toISOString(),
            user: r.checkedInBy!.name,
            reservation: r.code,
            guest: guestName(r.guest),
            room: r.room?.number ?? null,
            stay: `${r.units} ${MODALITIES[r.modality].replace('Por ', '')}`,
            source: SOURCES[r.source],
            amount: r.totalAmount * 100,
          })),
          totals: { amount: totals.amount },
        },
      ],
    };
  }

  /** Limpiezas por usuario. Limpieza solo ve las suyas. */
  private async housekeeping(actor: AuthUser, range: Range): Promise<Report> {
    const own = actor.role === 'HOUSEKEEPING';
    const cleaned = await this.prisma.roomStatusLog.findMany({
      where: {
        hotelId: actor.hotelId,
        cleanedAt: { gte: range.start, lt: range.end },
        // Las que vienen de una tarea se cuentan con la tarea (tiempo real).
        cleaningTaskId: null,
        ...(own ? { cleanedById: actor.id } : { cleanedById: { not: null } }),
      },
      select: {
        roomId: true,
        cleanedAt: true,
        createdAt: true,
        room: { select: { number: true } },
        cleanedBy: { select: { name: true } },
      },
      orderBy: { cleanedAt: 'asc' },
    });
    // Cuándo quedó sucia: el último cambio a Limpieza antes de limpiarla.
    const dirty = await this.prisma.roomStatusLog.findMany({
      where: {
        hotelId: actor.hotelId,
        roomId: { in: [...new Set(cleaned.map((c) => c.roomId))] },
        toStatus: 'CLEANING',
        createdAt: {
          gte: new Date(range.start.getTime() - 7 * 86_400_000),
          lt: range.end,
        },
      },
      select: { roomId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const minutesFor = (c: (typeof cleaned)[number]): number | null => {
      const before = dirty.filter(
        (d) => d.roomId === c.roomId && d.createdAt < c.createdAt,
      );
      const last = before.at(-1);
      return last
        ? Math.round(
            (c.cleanedAt!.getTime() - last.createdAt.getTime()) / 60_000,
          )
        : null;
    };

    const tasks = await this.prisma.cleaningTask.findMany({
      where: {
        hotelId: actor.hotelId,
        status: 'DONE',
        finishedAt: { gte: range.start, lt: range.end },
        ...(own ? { finishedById: actor.id } : { finishedById: { not: null } }),
      },
      select: {
        kind: true,
        startedAt: true,
        finishedAt: true,
        room: { select: { number: true } },
        finishedBy: { select: { name: true } },
      },
    });

    const detail = [
      ...cleaned.map((c) => ({
        at: c.cleanedAt!.toISOString(),
        user: c.cleanedBy!.name,
        room: c.room.number,
        kind: 'Salida',
        minutes: minutesFor(c),
      })),
      ...tasks.map((t) => ({
        at: t.finishedAt!.toISOString(),
        user: t.finishedBy!.name,
        room: t.room.number,
        kind: t.kind === 'DEPARTURE' ? 'Salida' : 'Repaso',
        minutes: t.startedAt
          ? Math.round(
              (t.finishedAt!.getTime() - t.startedAt.getTime()) / 60_000,
            )
          : null,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    const byUser = new Map<string, { count: number; minutes: number[] }>();
    for (const d of detail) {
      const row = byUser.get(d.user) ?? { count: 0, minutes: [] };
      row.count++;
      if (d.minutes !== null) row.minutes.push(d.minutes);
      byUser.set(d.user, row);
    }
    const avg = (xs: number[]) =>
      xs.length ? Math.round(xs.reduce((n, x) => n + x, 0) / xs.length) : 0;
    const userRows: ReportRow[] = [...byUser]
      .map(([name, v]) => ({
        name,
        count: v.count,
        perDay: Math.round((v.count / range.days.length) * 10) / 10,
        avgMinutes: avg(v.minutes),
      }))
      .sort((a, b) => b.count - a.count);
    const dayRows: ReportRow[] = range.days.map((date) => ({
      date,
      count: detail.filter(
        (d) => todayIn(range.timeZone, new Date(d.at)) === date,
      ).length,
    }));
    const allMinutes = detail
      .map((d) => d.minutes)
      .filter((m): m is number => m !== null);

    return {
      kind: 'housekeeping',
      title: own ? 'Mis limpiezas' : 'Limpieza por usuario',
      from: range.from,
      to: range.to,
      notes:
        'Tiempo = de «Empezar» a «Terminar» en la tarea. Si se marcó limpia desde el tablero sin tarea, cuenta desde que pasó a Limpieza (incluye la espera).',
      summary: [
        { label: 'Habitaciones limpiadas', value: detail.length, type: 'int' },
        {
          label: 'Promedio por día',
          value: Math.round((detail.length / range.days.length) * 10) / 10,
          type: 'int',
        },
        { label: 'Tiempo promedio (min)', value: avg(allMinutes), type: 'int' },
      ],
      sections: [
        ...(own
          ? []
          : [
              {
                title: 'Por usuario',
                columns: [
                  { key: 'name', label: 'Usuario', type: 'text' as const },
                  { key: 'count', label: 'Limpiezas', type: 'int' as const },
                  {
                    key: 'perDay',
                    label: 'Promedio por día',
                    type: 'int' as const,
                  },
                  {
                    key: 'avgMinutes',
                    label: 'Tiempo promedio (min)',
                    type: 'int' as const,
                  },
                ],
                rows: userRows,
                totals: sumRows(userRows, ['count']),
              },
            ]),
        {
          title: 'Por día',
          columns: [
            { key: 'date', label: 'Día', type: 'date' },
            { key: 'count', label: 'Limpiezas', type: 'int' },
          ],
          rows: dayRows,
          totals: { count: detail.length },
        },
        {
          title: 'Detalle',
          columns: [
            { key: 'at', label: 'Fecha', type: 'datetime' },
            { key: 'user', label: 'Limpió', type: 'text' },
            { key: 'room', label: 'Habitación', type: 'text' },
            { key: 'kind', label: 'Tipo', type: 'text' },
            { key: 'minutes', label: 'Tiempo (min)', type: 'int' },
          ],
          rows: detail,
        },
      ],
    };
  }
}
