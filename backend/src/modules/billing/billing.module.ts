import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CashModule } from '../cash/cash.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  imports: [AuthModule, CashModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
