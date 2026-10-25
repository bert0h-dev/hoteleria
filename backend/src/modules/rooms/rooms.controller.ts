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
  ChangeRoomStatusDto,
  CreateRoomDto,
  QueryRoomsDto,
  UpdateBlockedUntilDto,
  UpdateRoomDto,
} from './dto/room.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  findAll(@CurrentUser() actor: AuthUser, @Query() query: QueryRoomsDto) {
    return this.rooms.findAll(actor, query);
  }

  @Get('summary')
  summary(@CurrentUser() actor: AuthUser) {
    return this.rooms.summary(actor);
  }

  @Get('housekeepers')
  @Roles(Role.ADMIN, Role.RECEPTION)
  housekeepers(@CurrentUser() actor: AuthUser) {
    return this.rooms.housekeepers(actor);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.rooms.findOne(actor, id);
  }

  @Get(':id/history')
  history(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.rooms.history(actor, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateRoomDto) {
    return this.rooms.create(actor, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.rooms.update(actor, id, dto);
  }

  /** Ajusta la fecha estimada de un bloqueo sin cambiar el estado. */
  @Patch(':id/blocked-until')
  @Roles(Role.ADMIN, Role.RECEPTION)
  updateBlockedUntil(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateBlockedUntilDto,
  ) {
    return this.rooms.updateBlockedUntil(actor, id, dto);
  }

  /** Todos los roles; las reglas por rol están en room-status.rules.ts. */
  @Patch(':id/status')
  changeStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: ChangeRoomStatusDto,
  ) {
    return this.rooms.changeStatus(actor, id, dto);
  }
}
