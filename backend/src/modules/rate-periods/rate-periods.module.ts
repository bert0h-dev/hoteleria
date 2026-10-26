import { Module } from '@nestjs/common';
import { RatePeriodsController } from './rate-periods.controller.js';
import { RatePeriodsService } from './rate-periods.service.js';

@Module({
  controllers: [RatePeriodsController],
  providers: [RatePeriodsService],
  exports: [RatePeriodsService],
})
export class RatePeriodsModule {}
