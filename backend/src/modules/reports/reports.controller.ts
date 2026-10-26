import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReportQueryDto } from './dto/report-query.dto.js';
import { reportToXlsx } from './report-xlsx.js';
import { REPORT_KINDS, type ReportKind } from './report.types.js';
import { ReportsService } from './reports.service.js';

/** Quién puede ver cada reporte (Limpieza solo ve sus propias limpiezas). */
const ACCESS: Record<ReportKind, Role[]> = {
  occupancy: ['ADMIN'],
  revenue: ['ADMIN'],
  payments: ['ADMIN'],
  discounts: ['ADMIN'],
  reservations: ['ADMIN'],
  rentals: ['ADMIN', 'RECEPTION'],
  housekeeping: ['ADMIN', 'RECEPTION', 'HOUSEKEEPING'],
  maintenance: ['ADMIN'],
};

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':kind')
  get(
    @CurrentUser() actor: AuthUser,
    @Param('kind') kind: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.build(
      actor,
      this.allowed(actor, kind),
      query.from,
      query.to,
    );
  }

  @Get(':kind/xlsx')
  async xlsx(
    @CurrentUser() actor: AuthUser,
    @Param('kind') kind: string,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reports.build(
      actor,
      this.allowed(actor, kind),
      query.from,
      query.to,
    );
    const hotel = await this.prisma.hotel.findUniqueOrThrow({
      where: { id: actor.hotelId },
      select: { name: true, timezone: true },
    });
    const buffer = await reportToXlsx(report, hotel.name, hotel.timezone);
    const file = `${report.kind}_${query.from}_${query.to}.xlsx`;
    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${file}"`,
      })
      .send(buffer);
  }

  private allowed(actor: AuthUser, kind: string): ReportKind {
    if (!(REPORT_KINDS as readonly string[]).includes(kind)) {
      throw new NotFoundException('Reporte no encontrado');
    }
    if (!ACCESS[kind as ReportKind].includes(actor.role)) {
      throw new ForbiddenException('No tienes permiso para ver este reporte');
    }
    return kind as ReportKind;
  }
}
