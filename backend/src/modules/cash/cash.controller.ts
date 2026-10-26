import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ParseUuid } from '../../common/validation/validation-messages.js';
import { CashService } from './cash.service.js';
import { CloseShiftDto, OpenShiftDto, QueryShiftsDto } from './dto/cash.dto.js';

/** Caja: ADMIN y RECEPTION; el historial de cortes solo ADMIN. */
@ApiTags('Cash')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.RECEPTION)
@Controller('cash-shifts')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('current')
  current(@CurrentUser() actor: AuthUser) {
    return this.cash.current(actor);
  }

  @Post()
  open(@CurrentUser() actor: AuthUser, @Body() dto: OpenShiftDto) {
    return this.cash.open(actor, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  list(@CurrentUser() actor: AuthUser, @Query() query: QueryShiftsDto) {
    return this.cash.list(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.cash.findOne(actor, id);
  }

  @Post(':id/close')
  close(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.cash.close(actor, id, dto);
  }
}
