import { Injectable } from '@nestjs/common';
import type { HotelSettings } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateHotelDto } from './dto/update-hotel.dto.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

const hotelSelect = {
  id: true,
  name: true,
  legalName: true,
  taxId: true,
  address: true,
  phone: true,
  email: true,
  timezone: true,
  currency: true,
} as const;

@Injectable()
export class HotelService {
  constructor(private readonly prisma: PrismaService) {}

  async get(hotelId: string) {
    const [hotel, settings] = await Promise.all([
      this.prisma.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: hotelSelect,
      }),
      this.getSettings(hotelId),
    ]);
    return { ...hotel, settings };
  }

  async update(hotelId: string, dto: UpdateHotelDto) {
    await this.prisma.hotel.update({ where: { id: hotelId }, data: dto });
    return this.get(hotelId);
  }

  /** Devuelve la configuración; si aún no existe, la crea con los valores por defecto. */
  getSettings(hotelId: string): Promise<HotelSettings> {
    return this.prisma.hotelSettings.upsert({
      where: { hotelId },
      create: { hotelId },
      update: {},
    });
  }

  updateSettings(hotelId: string, dto: UpdateSettingsDto) {
    return this.prisma.hotelSettings.upsert({
      where: { hotelId },
      create: {
        hotelId,
        hourlyRatePercent: dto.hourlyRatePercent,
        minHours: dto.minHours,
        dayRatePercent: dto.dayRatePercent,
        dayDurationHours: dto.dayDurationHours,
        weekRatePercent: dto.weekRatePercent,
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
        capHourlyAtDayRate: dto.capHourlyAtDayRate,
        vatPercent: dto.vatPercent,
        lodgingTaxPercent: dto.lodgingTaxPercent,
        childMaxAge: dto.childMaxAge,
      },
      update: dto,
    });
  }
}
