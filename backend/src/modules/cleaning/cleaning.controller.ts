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
import { CleaningService } from './cleaning.service.js';
import {
  CancelTaskDto,
  CreateStayoverDto,
  QueryTasksDto,
  UpdateTaskDto,
} from './dto/cleaning.dto.js';

/** Limpieza: todos la ven; pedir, asignar y cancelar es de ADMIN y recepción. */
@ApiTags('Cleaning')
@ApiBearerAuth()
@Controller('cleaning-tasks')
export class CleaningController {
  constructor(private readonly cleaning: CleaningService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() query: QueryTasksDto) {
    return this.cleaning.list(actor, query);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RECEPTION)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateStayoverDto) {
    return this.cleaning.createStayover(actor, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RECEPTION)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.cleaning.update(actor, id, dto);
  }

  @Post(':id/take')
  take(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.cleaning.take(actor, id);
  }

  @Post(':id/start')
  start(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.cleaning.start(actor, id);
  }

  @Post(':id/finish')
  finish(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.cleaning.finish(actor, id);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.RECEPTION)
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: CancelTaskDto,
  ) {
    return this.cleaning.cancel(actor, id, dto.reason);
  }
}
