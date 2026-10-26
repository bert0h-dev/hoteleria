import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ParseUuid } from '../../common/validation/validation-messages.js';
import {
  CancelTicketDto,
  CreateTicketDto,
  QueryTicketsDto,
  ResolveTicketDto,
} from './dto/maintenance.dto.js';
import { MaintenanceService } from './maintenance.service.js';

/** Mantenimiento: cualquiera reporta; ADMIN y recepción atienden. */
@ApiTags('Maintenance')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.RECEPTION)
@Controller('maintenance-tickets')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() query: QueryTicketsDto) {
    return this.maintenance.list(actor, query);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RECEPTION, Role.HOUSEKEEPING)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateTicketDto) {
    return this.maintenance.create(actor, dto);
  }

  @Post(':id/start')
  start(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.maintenance.start(actor, id);
  }

  @Post(':id/resolve')
  resolve(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: ResolveTicketDto,
  ) {
    return this.maintenance.resolve(actor, id, dto);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: CancelTicketDto,
  ) {
    return this.maintenance.cancel(actor, id, dto.reason);
  }
}
