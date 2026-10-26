import {
  Body,
  Controller,
  Delete,
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
  BlockGuestDto,
  CreateGuestDto,
  DuplicatesQueryDto,
  QueryGuestsDto,
  UpdateGuestDto,
} from './dto/guest.dto.js';
import {
  CreateTaxProfileDto,
  UpdateTaxProfileDto,
} from './dto/tax-profile.dto.js';
import { GuestsService } from './guests.service.js';

/** Recepción y administración; limpieza no tiene acceso. */
@ApiTags('Guests')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.RECEPTION)
@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  findAll(@CurrentUser() actor: AuthUser, @Query() query: QueryGuestsDto) {
    return this.guests.findAll(actor, query);
  }

  @Get('duplicates')
  duplicates(
    @CurrentUser() actor: AuthUser,
    @Query() query: DuplicatesQueryDto,
  ) {
    return this.guests.duplicates(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.guests.findOne(actor, id);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateGuestDto) {
    return this.guests.create(actor, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guests.update(actor, id, dto);
  }

  @Patch(':id/block')
  @Roles(Role.ADMIN)
  block(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: BlockGuestDto,
  ) {
    return this.guests.setBlocked(actor, id, dto.isBlocked, dto.reason);
  }

  // --- Datos fiscales ---

  @Post(':id/tax-profiles')
  addTaxProfile(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: CreateTaxProfileDto,
  ) {
    return this.guests.addTaxProfile(actor, id, dto);
  }

  @Patch(':id/tax-profiles/:profileId')
  updateTaxProfile(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Param('profileId', ParseUuid) profileId: string,
    @Body() dto: UpdateTaxProfileDto,
  ) {
    return this.guests.updateTaxProfile(actor, id, profileId, dto);
  }

  @Delete(':id/tax-profiles/:profileId')
  removeTaxProfile(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Param('profileId', ParseUuid) profileId: string,
  ) {
    return this.guests.removeTaxProfile(actor, id, profileId);
  }
}
