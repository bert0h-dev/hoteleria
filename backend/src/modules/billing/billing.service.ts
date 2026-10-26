import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { Currency } from '../../generated/prisma/enums.js';
import { todayIn, toDbDate } from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import type {
  AddChargeDto,
  AddDiscountDto,
  CreateConceptDto,
  PaymentDto,
  RefundDto,
  ResolveStayChargeDto,
  UpdateConceptDto,
} from './dto/billing.dto.js';
import {
  exceedsDiscountCap,
  folioTotals,
  percentOfCents,
  toCents,
  usdToMxnCents,
} from './folio-math.js';

type Tx = Prisma.TransactionClient;

const person = { select: { id: true, name: true } } as const;

/** Reservas a las que todavía se les puede cargar o cobrar. */
const BILLABLE = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const;

// Diferencia aceptable al convertir dólares (redondeo).
const USD_TOLERANCE_CENTS = 100;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  // -------------------------------------------------------------------------
  // Tipo de cambio
  // -------------------------------------------------------------------------

  async todayRate(actor: AuthUser) {
    const today = todayIn(await this.timeZone(actor));
    const row = await this.prisma.exchangeRate.findUnique({
      where: {
        hotelId_date: { hotelId: actor.hotelId, date: toDbDate(today) },
      },
      include: { createdBy: person },
    });
    return {
      date: today,
      rate: row ? Number(row.rate) : null,
      createdBy: row?.createdBy ?? null,
      createdAt: row?.createdAt ?? null,
    };
  }

  /**
   * Captura el tipo de cambio del día. Recepción solo puede capturarlo si
   * aún no existe; el administrador puede corregirlo.
   */
  async setTodayRate(actor: AuthUser, rate: number) {
    const today = todayIn(await this.timeZone(actor));
    const key = { hotelId: actor.hotelId, date: toDbDate(today) };
    const existing = await this.prisma.exchangeRate.findUnique({
      where: { hotelId_date: key },
    });
    if (existing && actor.role !== 'ADMIN') {
      throw new ConflictException(
        'El tipo de cambio de hoy ya se capturó; solo un administrador puede corregirlo',
      );
    }
    await this.prisma.exchangeRate.upsert({
      where: { hotelId_date: key },
      create: { ...key, rate, createdById: actor.id },
      update: { rate, createdById: actor.id },
    });
    return this.todayRate(actor);
  }

  async rateHistory(actor: AuthUser) {
    const rows = await this.prisma.exchangeRate.findMany({
      where: { hotelId: actor.hotelId },
      include: { createdBy: person },
      orderBy: { date: 'desc' },
      take: 60,
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      rate: Number(r.rate),
      createdBy: r.createdBy,
      updatedAt: r.updatedAt,
    }));
  }

  // -------------------------------------------------------------------------
  // Catálogo de conceptos
  // -------------------------------------------------------------------------

  concepts(actor: AuthUser, includeInactive = false) {
    return this.prisma.chargeConcept.findMany({
      where: {
        hotelId: actor.hotelId,
        ...(!includeInactive && { isActive: true }),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async createConcept(actor: AuthUser, dto: CreateConceptDto) {
    try {
      return await this.prisma.chargeConcept.create({
        data: {
          hotelId: actor.hotelId,
          name: dto.name,
          category: dto.category,
          priceCents: toCents(dto.price),
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      throw mapUnique(error, 'Ya existe un concepto con ese nombre');
    }
  }

  async updateConcept(actor: AuthUser, id: string, dto: UpdateConceptDto) {
    const concept = await this.prisma.chargeConcept.findFirst({
      where: { id, hotelId: actor.hotelId },
    });
    if (!concept) throw new NotFoundException('Concepto no encontrado');
    try {
      return await this.prisma.chargeConcept.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          priceCents: dto.price === undefined ? undefined : toCents(dto.price),
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      throw mapUnique(error, 'Ya existe un concepto con ese nombre');
    }
  }

  // -------------------------------------------------------------------------
  // Folio
  // -------------------------------------------------------------------------

  /** Folio completo de una reserva: movimientos, cargos sugeridos y saldo. */
  async folio(
    actor: AuthUser,
    reservationId: string,
    db: Tx | PrismaService = this.prisma,
  ) {
    const reservation = await db.reservation.findFirst({
      where: { id: reservationId, hotelId: actor.hotelId },
      select: {
        id: true,
        code: true,
        status: true,
        totalAmount: true,
        requiresDeposit: true,
        balanceDueCents: true,
        balanceReason: true,
        balanceAuthorizedBy: person,
        guest: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { number: true } },
        folioCharges: {
          include: {
            createdBy: person,
            authorizedBy: person,
            voidedBy: person,
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          include: { createdBy: person, voidedBy: person },
          orderBy: { createdAt: 'asc' },
        },
        charges: {
          include: { resolvedBy: person, authorizedBy: person },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    const settings = await db.hotelSettings.findUniqueOrThrow({
      where: { hotelId: actor.hotelId },
      select: { discountCapPercent: true },
    });

    const active = <T extends { voidedAt: Date | null }>(xs: T[]) =>
      xs.filter((x) => !x.voidedAt);
    const charges = active(reservation.folioCharges).filter(
      (c) => c.kind === 'CHARGE',
    );
    const discounts = active(reservation.folioCharges).filter(
      (c) => c.kind === 'DISCOUNT',
    );
    const payments = active(reservation.payments);

    const totals = folioTotals({
      lodgingCents: reservation.totalAmount * 100,
      charges,
      discounts,
      payments,
    });
    // Lo condonado cuenta para el tope igual que un descuento.
    const waivedCents = reservation.charges
      .filter((c) => c.status === 'WAIVED')
      .reduce((acc, c) => acc + c.amount * 100, 0);

    return {
      reservation: {
        id: reservation.id,
        code: reservation.code,
        status: reservation.status,
        requiresDeposit: reservation.requiresDeposit,
        guest: reservation.guest,
        room: reservation.room,
        balanceDueCents: reservation.balanceDueCents,
        balanceReason: reservation.balanceReason,
        balanceAuthorizedBy: reservation.balanceAuthorizedBy,
      },
      totals,
      depositPaid: payments.some((p) => p.kind === 'PAYMENT'),
      discountCap: {
        percent: settings.discountCapPercent,
        capCents: percentOfCents(
          totals.grossCents,
          settings.discountCapPercent,
        ),
        usedCents: totals.discountsCents + waivedCents,
      },
      entries: reservation.folioCharges.map((c) => ({
        ...c,
        voided: !!c.voidedAt,
      })),
      payments: reservation.payments.map((p) => ({
        ...p,
        exchangeRate: p.exchangeRate === null ? null : Number(p.exchangeRate),
        voided: !!p.voidedAt,
      })),
      stayCharges: reservation.charges,
    };
  }

  /** Saldo (centavos) de varias reservas, para listas como Recepción. */
  async balances(reservationIds: string[]): Promise<Map<string, number>> {
    if (reservationIds.length === 0) return new Map();
    const [reservations, charges, payments] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { id: { in: reservationIds } },
        select: { id: true, totalAmount: true },
      }),
      this.prisma.folioCharge.groupBy({
        by: ['reservationId', 'kind'],
        where: { reservationId: { in: reservationIds }, voidedAt: null },
        _sum: { amountCents: true },
      }),
      this.prisma.payment.groupBy({
        by: ['reservationId', 'kind'],
        where: { reservationId: { in: reservationIds }, voidedAt: null },
        _sum: { amountMxnCents: true },
      }),
    ]);
    const result = new Map<string, number>();
    for (const r of reservations) result.set(r.id, r.totalAmount * 100);
    for (const c of charges) {
      const sign = c.kind === 'CHARGE' ? 1 : -1;
      result.set(
        c.reservationId,
        (result.get(c.reservationId) ?? 0) + sign * (c._sum.amountCents ?? 0),
      );
    }
    for (const p of payments) {
      const sign = p.kind === 'PAYMENT' ? -1 : 1;
      result.set(
        p.reservationId,
        (result.get(p.reservationId) ?? 0) +
          sign * (p._sum.amountMxnCents ?? 0),
      );
    }
    return result;
  }

  async addCharge(actor: AuthUser, reservationId: string, dto: AddChargeDto) {
    await this.billable(actor, reservationId);
    const concept = dto.conceptId
      ? await this.prisma.chargeConcept.findFirst({
          where: { id: dto.conceptId, hotelId: actor.hotelId, isActive: true },
        })
      : null;
    if (dto.conceptId && !concept) {
      throw new NotFoundException('Concepto no encontrado o inactivo');
    }
    const description = dto.description || concept?.name;
    if (!description) {
      throw new BadRequestException(
        'Elige un concepto o escribe la descripción',
      );
    }
    const unitPriceCents =
      dto.unitPrice !== undefined
        ? toCents(dto.unitPrice)
        : concept?.priceCents;
    if (!unitPriceCents) {
      throw new BadRequestException('Indica el precio del cargo');
    }
    const quantity = dto.quantity ?? 1;

    await this.prisma.folioCharge.create({
      data: {
        hotelId: actor.hotelId,
        reservationId,
        kind: 'CHARGE',
        conceptId: concept?.id,
        description,
        quantity,
        unitPriceCents,
        amountCents: unitPriceCents * quantity,
        createdById: actor.id,
      },
    });
    return this.folio(actor, reservationId);
  }

  /**
   * Descuento por monto o porcentaje de la cuenta. Dentro del tope lo
   * aplica cualquiera; arriba del tope necesita permiso de descuentos sin
   * límite o la autorización (PIN) de alguien que pueda autorizar.
   */
  async addDiscount(
    actor: AuthUser,
    reservationId: string,
    dto: AddDiscountDto,
  ) {
    await this.billable(actor, reservationId);
    if ((dto.amount === undefined) === (dto.percent === undefined)) {
      throw new BadRequestException(
        'Indica el descuento como monto o como porcentaje',
      );
    }
    const folio = await this.folio(actor, reservationId);
    const amountCents =
      dto.amount !== undefined
        ? toCents(dto.amount)
        : percentOfCents(folio.totals.grossCents, dto.percent!);
    if (amountCents > folio.totals.netCents) {
      throw new BadRequestException(
        'El descuento no puede ser mayor que la cuenta',
      );
    }

    const authorizedById = await this.capAuthorization(
      actor,
      folio,
      amountCents,
      dto.authorization,
      'Un descuento arriba del tope',
    );
    await this.prisma.folioCharge.create({
      data: {
        hotelId: actor.hotelId,
        reservationId,
        kind: 'DISCOUNT',
        description:
          dto.percent !== undefined
            ? `Descuento ${dto.percent} %`
            : 'Descuento',
        unitPriceCents: amountCents,
        amountCents,
        reason: dto.reason,
        authorizedById,
        createdById: actor.id,
      },
    });
    return this.folio(actor, reservationId);
  }

  /**
   * Confirma un cargo sugerido (pasa al folio) o lo condona (con motivo y
   * con el mismo tope que un descuento).
   */
  async resolveStayCharge(
    actor: AuthUser,
    reservationId: string,
    chargeId: string,
    dto: ResolveStayChargeDto,
  ) {
    await this.billable(actor, reservationId);
    const charge = await this.prisma.stayCharge.findFirst({
      where: { id: chargeId, reservationId, hotelId: actor.hotelId },
    });
    if (!charge) throw new NotFoundException('Cargo no encontrado');
    if (charge.status !== 'SUGGESTED') {
      throw new BadRequestException('Este cargo ya se confirmó o se condonó');
    }

    if (dto.action === 'CONFIRM') {
      await this.prisma.$transaction([
        this.prisma.stayCharge.update({
          where: { id: chargeId },
          data: {
            status: 'CONFIRMED',
            resolvedAt: new Date(),
            resolvedById: actor.id,
          },
        }),
        this.prisma.folioCharge.create({
          data: {
            hotelId: actor.hotelId,
            reservationId,
            kind: 'CHARGE',
            stayChargeId: chargeId,
            description: charge.description,
            unitPriceCents: charge.amount * 100,
            amountCents: charge.amount * 100,
            createdById: actor.id,
          },
        }),
      ]);
      return this.folio(actor, reservationId);
    }

    if (!dto.reason) {
      throw new BadRequestException('Indica el motivo para condonar el cargo');
    }
    const folio = await this.folio(actor, reservationId);
    const authorizedById = await this.capAuthorization(
      actor,
      folio,
      charge.amount * 100,
      dto.authorization,
      'Condonar un cargo arriba del tope',
    );
    await this.prisma.stayCharge.update({
      where: { id: chargeId },
      data: {
        status: 'WAIVED',
        resolvedAt: new Date(),
        resolvedById: actor.id,
        waiveReason: dto.reason,
        authorizedById,
      },
    });
    return this.folio(actor, reservationId);
  }

  async addPayment(actor: AuthUser, reservationId: string, dto: PaymentDto) {
    const reservation = await this.billable(actor, reservationId);
    const currency: Currency = dto.currency ?? 'MXN';
    const amountCents = toCents(dto.amount);

    let exchangeRate: number | null = null;
    let amountMxnCents = amountCents;
    if (currency === 'USD') {
      const today = await this.todayRate(actor);
      if (!today.rate) {
        throw new BadRequestException(
          'Captura el tipo de cambio de hoy para recibir dólares',
        );
      }
      exchangeRate = today.rate;
      amountMxnCents = usdToMxnCents(amountCents, today.rate);
    }

    const folio = await this.folio(actor, reservationId);
    const tolerance = currency === 'USD' ? USD_TOLERANCE_CENTS : 0;
    if (amountMxnCents > folio.totals.balanceCents + tolerance) {
      throw new BadRequestException(
        folio.totals.balanceCents <= 0
          ? 'La cuenta ya está pagada'
          : `El pago supera el saldo de ${formatCents(folio.totals.balanceCents)}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          hotelId: actor.hotelId,
          reservationId,
          receiptNumber: await nextReceipt(tx, actor.hotelId),
          kind: 'PAYMENT',
          method: dto.method,
          currency,
          amountCents,
          exchangeRate,
          // Con dólares, el redondeo no puede dejar un saldo negativo de centavos.
          amountMxnCents: Math.min(
            amountMxnCents,
            Math.max(folio.totals.balanceCents, 0),
          ),
          reference: dto.reference,
          notes: dto.notes,
          isDeposit: reservation.status === 'CONFIRMED',
          createdById: actor.id,
        },
      });
    });
    return this.folio(actor, reservationId);
  }

  /** Devolución cuando se pagó de más (saldo negativo). */
  async refund(actor: AuthUser, reservationId: string, dto: RefundDto) {
    await this.billable(actor, reservationId);
    const folio = await this.folio(actor, reservationId);
    const amountCents = toCents(dto.amount);
    if (folio.totals.balanceCents >= 0) {
      throw new BadRequestException('No hay saldo a favor del huésped');
    }
    if (amountCents > -folio.totals.balanceCents) {
      throw new BadRequestException(
        `La devolución supera el saldo a favor de ${formatCents(-folio.totals.balanceCents)}`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          hotelId: actor.hotelId,
          reservationId,
          receiptNumber: await nextReceipt(tx, actor.hotelId),
          kind: 'REFUND',
          method: dto.method,
          amountCents,
          amountMxnCents: amountCents,
          notes: dto.reason,
          createdById: actor.id,
        },
      });
    });
    return this.folio(actor, reservationId);
  }

  /** Cancela un pago (no se borra; queda con motivo). Solo ADMIN. */
  async voidPayment(
    actor: AuthUser,
    reservationId: string,
    paymentId: string,
    reason: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, reservationId, hotelId: actor.hotelId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.voidedAt)
      throw new BadRequestException('El pago ya está cancelado');
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedById: actor.id, voidReason: reason },
    });
    return this.folio(actor, reservationId);
  }

  /** Cancela un cargo o descuento (no se borra). Solo ADMIN. */
  async voidEntry(
    actor: AuthUser,
    reservationId: string,
    entryId: string,
    reason: string,
  ) {
    const entry = await this.prisma.folioCharge.findFirst({
      where: { id: entryId, reservationId, hotelId: actor.hotelId },
    });
    if (!entry) throw new NotFoundException('Movimiento no encontrado');
    if (entry.voidedAt)
      throw new BadRequestException('El movimiento ya está cancelado');
    await this.prisma.$transaction(async (tx) => {
      await tx.folioCharge.update({
        where: { id: entryId },
        data: {
          voidedAt: new Date(),
          voidedById: actor.id,
          voidReason: reason,
        },
      });
      // Si era un cargo sugerido confirmado, vuelve a quedar como sugerido.
      if (entry.stayChargeId) {
        await tx.folioCharge.update({
          where: { id: entryId },
          data: { stayChargeId: null },
        });
        await tx.stayCharge.update({
          where: { id: entry.stayChargeId },
          data: { status: 'SUGGESTED', resolvedAt: null, resolvedById: null },
        });
      }
    });
    return this.folio(actor, reservationId);
  }

  /** Recibo de un pago (para imprimir). */
  async receipt(actor: AuthUser, reservationId: string, paymentId: string) {
    const folio = await this.folio(actor, reservationId);
    const payment = folio.payments.find((p) => p.id === paymentId);
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return { payment, folio };
  }

  // -------------------------------------------------------------------------

  /**
   * Quién autoriza una operación sujeta al tope de descuento (null si no
   * hace falta autorización).
   */
  private async capAuthorization(
    actor: AuthUser,
    folio: Awaited<ReturnType<BillingService['folio']>>,
    newCents: number,
    authorization: AddDiscountDto['authorization'],
    what: string,
  ): Promise<string | null> {
    const over = exceedsDiscountCap({
      grossCents: folio.totals.grossCents,
      previousCents: folio.discountCap.usedCents,
      newCents,
      capPercent: folio.discountCap.percent,
    });
    if (!over) return null;
    const { canDiscountUnlimited } =
      await this.authorization.permissions(actor);
    if (canDiscountUnlimited) return null;
    return this.authorization.resolve(actor, authorization, what);
  }

  private async billable(actor: AuthUser, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, hotelId: actor.hotelId },
      select: { id: true, status: true },
    });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    if (!(BILLABLE as readonly string[]).includes(reservation.status)) {
      throw new BadRequestException(
        'No se puede cargar ni cobrar en una reserva cancelada o que no se presentó',
      );
    }
    return reservation;
  }

  private async timeZone(actor: AuthUser) {
    const hotel = await this.prisma.hotel.findUniqueOrThrow({
      where: { id: actor.hotelId },
      select: { timezone: true },
    });
    return hotel.timezone;
  }
}

/** Siguiente folio de recibo (A-000001…), dentro de la transacción. */
async function nextReceipt(tx: Tx, hotelId: string): Promise<string> {
  const settings = await tx.hotelSettings.update({
    where: { hotelId },
    data: { nextReceiptNumber: { increment: 1 } },
    select: { receiptSeries: true, nextReceiptNumber: true },
  });
  const number = settings.nextReceiptNumber - 1;
  return `${settings.receiptSeries}-${String(number).padStart(6, '0')}`;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function mapUnique(error: unknown, message: string): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException(message);
  }
  return error;
}
