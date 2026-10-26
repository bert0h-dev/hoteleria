import { Module } from '@nestjs/common';
import { CleaningController } from './cleaning.controller.js';
import { CleaningService } from './cleaning.service.js';

@Module({
  controllers: [CleaningController],
  providers: [CleaningService],
})
export class CleaningModule {}
