import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RatePeriod } from '../../generated/prisma/client.js';
import { fromDbDate, toDbDate } from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService, changedFields } from '../audit/audit.service.js';
import type { SeasonRule, WeekdayRule } from '../pricing/pricing.js';
import type {
  CreateRatePeriodDto,
  UpdateRatePeriodDto,
} from './dto/rate-period.dto.js';

@Injectable()
export class RatePeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser) {
    const rows = await this.prisma.ratePeriod.findMany({
      where: { hotelId: actor.hotelId },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    });
    return rows.map(present);
  }

  async create(actor: AuthUser, dto: CreateRatePeriodDto) {
    assertRange(dto.startDate, dto.endDate);
    const row = await this.prisma.ratePeriod.create({
      data: {
        hotelId: actor.hotelId,
        name: dto.name,
        startDate: toDbDate(dto.startDate),
        endDate: toDbDate(dto.endDate),
        adjustmentPercent: dto.adjustmentPercent,
        priority: dto.priority,
        color: dto.color,
        isActive: dto.isActive,
      },
    });
    await this.audit.log(actor, {
      action: 'rate_period.create',
      entity: 'rate_period',
      entityId: row.id,
      summary: `Creó la temporada «${row.name}» (${dto.startDate} a ${dto.endDate}, ${row.adjustmentPercent} %)`,
    });
    return present(row);
  }

  async update(actor: AuthUser, id: string, dto: UpdateRatePeriodDto) {
    const current = await this.findRow(actor, id);
    assertRange(
      dto.startDate ?? fromDbDate(current.startDate),
      dto.endDate ?? fromDbDate(current.endDate),
    );
    const row = await this.prisma.ratePeriod.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate && toDbDate(dto.startDate),
        endDate: dto.endDate && toDbDate(dto.endDate),
        adjustmentPercent: dto.adjustmentPercent,
        priority: dto.priority,
        color: dto.color,
        isActive: dto.isActive,
      },
    });
    const changes = changedFields(present(current), dto);
    if (Object.keys(changes).length) {
      await this.audit.log(actor, {
        action: 'rate_period.update',
        entity: 'rate_period',
        entityId: id,
        summary: `Modificó la temporada «${row.name}» (${Object.keys(changes).join(', ')})`,
        data: changes as never,
      });
    }
    return present(row);
  }

  async remove(actor: AuthUser, id: string) {
    const current = await this.findRow(actor, id);
    await this.prisma.ratePeriod.delete({ where: { id } });
    await this.audit.log(actor, {
      action: 'rate_period.delete',
      entity: 'rate_period',
      entityId: id,
      summary: `Eliminó la temporada «${current.name}»`,
    });
  }

  /**
   * Temporadas activas que tocan [from, to] y la regla de días de la
   * semana: todo lo necesario para cotizar o pintar el calendario.
   */
  async pricingCalendar(
    hotelId: string,
    from: string,
    to: string,
  ): Promise<{
    seasons: (SeasonRule & { id: string })[];
    weekday: WeekdayRule;
  }> {
    const [rows, settings] = await Promise.all([
      this.prisma.ratePeriod.findMany({
        where: {
          hotelId,
          isActive: true,
          startDate: { lte: toDbDate(to) },
          endDate: { gte: toDbDate(from) },
        },
      }),
      this.prisma.hotelSettings.findUnique({
        where: { hotelId },
        select: { weekdayAdjustDays: true, weekdayAdjustPercent: true },
      }),
    ]);
    return {
      seasons: rows.map(present),
      weekday: {
        days: settings?.weekdayAdjustDays ?? [],
        percent: settings?.weekdayAdjustPercent ?? 0,
      },
    };
  }

  private async findRow(actor: AuthUser, id: string) {
    const row = await this.prisma.ratePeriod.findFirst({
      where: { id, hotelId: actor.hotelId },
    });
    if (!row) throw new NotFoundException('Temporada no encontrada');
    return row;
  }
}

function assertRange(start: string, end: string) {
  if (end < start) {
    throw new BadRequestException(
      'La fecha de fin no puede ser anterior a la de inicio',
    );
  }
}

/** Fechas como YYYY-MM-DD. */
function present(row: RatePeriod) {
  return {
    ...row,
    startDate: fromDbDate(row.startDate),
    endDate: fromDbDate(row.endDate),
  };
}
