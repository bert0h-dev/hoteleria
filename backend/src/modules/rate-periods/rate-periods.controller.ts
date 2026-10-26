import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ParseUuid } from '../../common/validation/validation-messages.js';
import {
  CreateRatePeriodDto,
  UpdateRatePeriodDto,
} from './dto/rate-period.dto.js';
import { RatePeriodsService } from './rate-periods.service.js';

/** Temporadas: consultar ADMIN y RECEPTION; administrar solo ADMIN. */
@ApiTags('Rate periods')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.RECEPTION)
@Controller('rate-periods')
export class RatePeriodsController {
  constructor(private readonly periods: RatePeriodsService) {}

  @Get()
  findAll(@CurrentUser() actor: AuthUser) {
    return this.periods.findAll(actor);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateRatePeriodDto) {
    return this.periods.create(actor, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateRatePeriodDto,
  ) {
    return this.periods.update(actor, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.periods.remove(actor, id);
  }
}
