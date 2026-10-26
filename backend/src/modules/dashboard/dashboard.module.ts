import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [ReservationsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
