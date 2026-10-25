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
  CreateRoomTypeDto,
  QueryRoomTypesDto,
  UpdateRoomTypeDto,
} from './dto/room-type.dto.js';
import { RoomTypesService } from './room-types.service.js';

@ApiTags('Room types')
@ApiBearerAuth()
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @Get()
  findAll(@CurrentUser() actor: AuthUser, @Query() query: QueryRoomTypesDto) {
    return this.roomTypes.findAll(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.roomTypes.findOne(actor, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateRoomTypeDto) {
    return this.roomTypes.create(actor, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.roomTypes.update(actor, id, dto);
  }
}
