import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UpdateHotelDto } from './dto/update-hotel.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { HotelService } from './hotel.service.js';

@ApiTags('Hotel')
@ApiBearerAuth()
@Controller('hotel')
export class HotelController {
  constructor(private readonly hotel: HotelService) {}

  /** Datos del hotel y su configuración de tarifas (todos los roles). */
  @Get()
  get(@CurrentUser() actor: AuthUser) {
    return this.hotel.get(actor.hotelId);
  }

  @Patch()
  @Roles(Role.ADMIN)
  update(@CurrentUser() actor: AuthUser, @Body() dto: UpdateHotelDto) {
    return this.hotel.update(actor, dto);
  }

  @Patch('settings')
  @Roles(Role.ADMIN)
  updateSettings(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.hotel.updateSettings(actor, dto);
  }
}
