import { Module } from '@nestjs/common';
import { HotelModule } from '../hotel/hotel.module.js';
import { RatePeriodsModule } from '../rate-periods/rate-periods.module.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';
import { StaysService } from './stays.service.js';

@Module({
  imports: [HotelModule, RatePeriodsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, StaysService],
})
export class ReservationsModule {}
