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
import {
  AssignRoomDto,
  ExtendStayDto,
  GuestCountDto,
  WalkInDto,
} from './dto/stay-operations.dto.js';
import { CheckOutDto } from '../billing/dto/billing.dto.js';
import { ReservationsService } from './reservations.service.js';
import { StaysService } from './stays.service.js';

/** Recepción y administración; limpieza no tiene acceso. */
@ApiTags('Reservations')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.RECEPTION)
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly stays: StaysService,
  ) {}

  /** Disponibilidad y precio por tipo (no guarda nada). */
  @Post('quote')
  quote(@CurrentUser() actor: AuthUser, @Body() dto: StayDto) {
    return this.reservations.quote(actor, dto);
  }

  /** Pantalla de recepción: llegadas, huéspedes en casa y salidas. */
  @Get('front-desk')
  frontDesk(@CurrentUser() actor: AuthUser) {
    return this.stays.frontDesk(actor);
  }

  /** Llegada sin reserva: crea la reserva y hace el check-in. */
  @Post('walk-in')
  walkIn(@CurrentUser() actor: AuthUser, @Body() dto: WalkInDto) {
    return this.stays.walkIn(actor, dto);
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

  /** Habitaciones que se pueden asignar (incluye mejoras de categoría). */
  @Get(':id/available-rooms')
  availableRooms(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
  ) {
    return this.stays.availableRooms(actor, id);
  }

  @Post(':id/check-in')
  checkIn(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: AssignRoomDto,
  ) {
    return this.stays.checkIn(actor, id, dto.roomId, dto.reason, {
      adults: dto.adults,
      children: dto.children,
    });
  }

  @Post(':id/move')
  move(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: AssignRoomDto,
  ) {
    return this.stays.moveRoom(actor, id, dto.roomId, dto.reason);
  }

  @Post(':id/extend')
  extend(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: ExtendStayDto,
  ) {
    return this.stays.extend(actor, id, dto);
  }

  /** Cambiar la cantidad de personas (confirmada o en casa). */
  @Post(':id/guests')
  changeGuests(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: GuestCountDto,
  ) {
    return this.stays.changeGuests(actor, id, dto);
  }

  @Post(':id/check-out')
  checkOut(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.stays.checkOut(actor, id, dto);
  }

  @Post(':id/no-show')
  noShow(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.reservations.markNoShow(actor, id);
  }
}
