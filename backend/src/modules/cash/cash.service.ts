import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Paginated } from '../../common/types/paginated.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { toCents } from '../billing/folio-math.js';
import type {
  CloseShiftDto,
  OpenShiftDto,
  QueryShiftsDto,
} from './dto/cash.dto.js';
import { shiftTotals, type ShiftTotals } from './shift-math.js';

type Db = Prisma.TransactionClient | PrismaService;

const person = { select: { id: true, name: true } } as const;

/** Turnos de caja: cada usuario abre el suyo, cobra y hace su corte. */
@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Turno abierto del usuario; si no tiene, no puede cobrar. */
  async requireOpenShift(actor: AuthUser, db: Db = this.prisma) {
    const shift = await db.cashShift.findFirst({
      where: { userId: actor.id, hotelId: actor.hotelId, closedAt: null },
      select: { id: true },
    });
    if (!shift) {
      throw new ConflictException('Abre tu turno de caja para poder cobrar');
    }
    return shift.id;
  }

  /** Mi turno abierto con sus totales (null si no tengo). */
  async current(actor: AuthUser) {
    const shift = await this.prisma.cashShift.findFirst({
      where: { userId: actor.id, hotelId: actor.hotelId, closedAt: null },
      include: { user: person },
    });
    if (!shift) return null;
    return { ...shift, totals: await this.liveTotals(shift) };
  }

  async open(actor: AuthUser, dto: OpenShiftDto) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.cashShift.create({
          data: {
            hotelId: actor.hotelId,
            userId: actor.id,
            openingMxnCents: toCents(dto.openingMxn ?? 0),
            openingUsdCents: toCents(dto.openingUsd ?? 0),
          },
        });
        await this.audit.log(
          actor,
          {
            action: 'cash.open',
            entity: 'cash_shift',
            entityId: created.id,
            summary: `Abrió turno de caja con fondo de ${money(created.openingMxnCents)} MXN y ${money(created.openingUsdCents)} USD`,
          },
          tx,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya tienes un turno de caja abierto');
      }
      throw error;
    }
    return this.current(actor);
  }

  /**
   * Corte de caja: compara el efectivo esperado con el contado. Si falta
   * efectivo exige un comentario. El ADMIN puede cerrar turnos ajenos.
   */
  async close(actor: AuthUser, id: string, dto: CloseShiftDto) {
    const shift = await this.prisma.cashShift.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: { user: person },
    });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    if (shift.userId !== actor.id && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo puedes cerrar tu propio turno');
    }
    if (shift.closedAt) {
      throw new BadRequestException('Este turno ya está cerrado');
    }

    const countedMxnCents = toCents(dto.countedMxn);
    const countedUsdCents = toCents(dto.countedUsd ?? 0);

    await this.prisma.$transaction(async (tx) => {
      const totals = await this.liveTotals(shift, tx);
      const short =
        countedMxnCents < totals.expectedMxnCents ||
        countedUsdCents < totals.expectedUsdCents;
      if (short && !dto.notes) {
        throw new BadRequestException(
          'Falta efectivo: escribe un comentario para cerrar el turno',
        );
      }
      // Solo cierra si sigue abierto (evita dos cortes simultáneos).
      const { count } = await tx.cashShift.updateMany({
        where: { id, closedAt: null },
        data: {
          closedAt: new Date(),
          closedById: actor.id,
          expectedMxnCents: totals.expectedMxnCents,
          expectedUsdCents: totals.expectedUsdCents,
          countedMxnCents,
          countedUsdCents,
          summary: totals as unknown as Prisma.InputJsonValue,
          closingNotes: dto.notes ?? null,
        },
      });
      if (!count) throw new BadRequestException('Este turno ya está cerrado');

      const diffMxn = countedMxnCents - totals.expectedMxnCents;
      const diffUsd = countedUsdCents - totals.expectedUsdCents;
      const owner = shift.userId !== actor.id ? ` de ${shift.user.name}` : '';
      await this.audit.log(
        actor,
        {
          action: 'cash.close',
          entity: 'cash_shift',
          entityId: id,
          summary: `Cerró el turno de caja${owner}: diferencia de ${signed(diffMxn)} MXN y ${signed(diffUsd)} USD`,
          data: { diffMxn, diffUsd, notes: dto.notes ?? null },
        },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  /** Historial de turnos (ADMIN). */
  async list(
    actor: AuthUser,
    query: QueryShiftsDto,
  ): Promise<Paginated<unknown>> {
    const where: Prisma.CashShiftWhereInput = {
      hotelId: actor.hotelId,
      ...(query.userId && { userId: query.userId }),
      ...(query.status === 'open' && { closedAt: null }),
      ...(query.status === 'closed' && { closedAt: { not: null } }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cashShift.findMany({
        where,
        include: {
          user: person,
          closedBy: person,
          _count: { select: { payments: true } },
        },
        orderBy: { openedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cashShift.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  /** Detalle del turno (reporte de corte). El dueño o un ADMIN. */
  async findOne(actor: AuthUser, id: string) {
    const shift = await this.prisma.cashShift.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: {
        user: person,
        closedBy: person,
        payments: {
          include: {
            reservation: {
              select: {
                id: true,
                code: true,
                guest: { select: { firstName: true, lastName: true } },
              },
            },
            voidedBy: person,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    if (shift.userId !== actor.id && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo puedes ver tus propios turnos');
    }
    // Cerrado: los totales del corte quedan fijos.
    const totals = shift.closedAt
      ? (shift.summary as unknown as ShiftTotals)
      : shiftTotals(shift, shift.payments);
    return { ...shift, totals };
  }

  private async liveTotals(
    shift: { id: string; openingMxnCents: number; openingUsdCents: number },
    db: Db = this.prisma,
  ) {
    const payments = await db.payment.findMany({
      where: { shiftId: shift.id },
      select: {
        kind: true,
        method: true,
        currency: true,
        amountCents: true,
        amountMxnCents: true,
        voidedAt: true,
      },
    });
    return shiftTotals(shift, payments);
  }
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function signed(cents: number) {
  if (cents > 0) return `+${money(cents)}`;
  if (cents < 0) return `-${money(-cents)}`;
  return money(0);
}
