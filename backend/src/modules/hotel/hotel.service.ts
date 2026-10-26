import { Injectable } from '@nestjs/common';
import type { HotelSettings } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService, changedFields } from '../audit/audit.service.js';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  async update(actor: AuthUser, dto: UpdateHotelDto) {
    const before = await this.prisma.hotel.findUniqueOrThrow({
      where: { id: actor.hotelId },
      select: hotelSelect,
    });
    await this.prisma.hotel.update({ where: { id: actor.hotelId }, data: dto });
    const changes = changedFields(before, dto);
    if (Object.keys(changes).length) {
      await this.audit.log(actor, {
        action: 'hotel.update',
        entity: 'hotel',
        entityId: actor.hotelId,
        summary: `Modificó los datos del hotel (${Object.keys(changes).join(', ')})`,
        data: changes as never,
      });
    }
    return this.get(actor.hotelId);
  }

  /** Devuelve la configuración; si aún no existe, la crea con los valores por defecto. */
  getSettings(hotelId: string): Promise<HotelSettings> {
    return this.prisma.hotelSettings.upsert({
      where: { hotelId },
      create: { hotelId },
      update: {},
    });
  }

  async updateSettings(actor: AuthUser, dto: UpdateSettingsDto) {
    const hotelId = actor.hotelId;
    const before = await this.getSettings(hotelId);
    const changes = changedFields(before, dto);
    if (Object.keys(changes).length) {
      await this.audit.log(actor, {
        action: 'settings.update',
        entity: 'hotel_settings',
        entityId: hotelId,
        summary: `Modificó la configuración (${Object.keys(changes).join(', ')})`,
        data: changes as never,
      });
    }
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
        weekdayAdjustDays: dto.weekdayAdjustDays,
        weekdayAdjustPercent: dto.weekdayAdjustPercent,
        discountCapPercent: dto.discountCapPercent,
        receiptSeries: dto.receiptSeries,
      },
      update: dto,
    });
  }
}
