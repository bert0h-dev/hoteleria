import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { HotelModule } from '../hotel/hotel.module.js';
import { RatePeriodsModule } from '../rate-periods/rate-periods.module.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';
import { StaysService } from './stays.service.js';

@Module({
  imports: [HotelModule, RatePeriodsModule, BillingModule, AuthModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, StaysService],
  exports: [ReservationsService, StaysService],
})
export class ReservationsModule {}
