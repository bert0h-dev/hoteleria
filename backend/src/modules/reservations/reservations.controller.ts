import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ParseUuid } from '../../common/validation/validation-messages.js';
import {
  CalendarQueryDto,
  CancelReservationDto,
  CreateReservationDto,
  QueryReservationsDto,
  StayDto,
  UpdateReservationDto,
} from './dto/reservation.dto.js';
import { ReservationsService } from './reservations.service.js';

/** Recepción y administración; limpieza no tiene acceso. */
@ApiTags('Reservations')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.RECEPTION)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  /** Disponibilidad y precio por tipo (no guarda nada). */
  @Post('quote')
  quote(@CurrentUser() actor: AuthUser, @Body() dto: StayDto) {
    return this.reservations.quote(actor, dto);
  }

  @Get('calendar')
  calendar(@CurrentUser() actor: AuthUser, @Query() query: CalendarQueryDto) {
    return this.reservations.calendar(actor, query);
  }

  @Get()
  findAll(
    @CurrentUser() actor: AuthUser,
    @Query() query: QueryReservationsDto,
  ) {
    return this.reservations.findAll(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.reservations.findOne(actor, id);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateReservationDto) {
    return this.reservations.create(actor, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservations.update(actor, id, dto);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservations.cancel(actor, id, dto.reason);
  }

  @Post(':id/no-show')
  noShow(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.reservations.markNoShow(actor, id);
  }
}
