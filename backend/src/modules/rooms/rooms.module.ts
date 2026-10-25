import { Module } from '@nestjs/common';
import { RoomTypesModule } from '../room-types/room-types.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [RoomTypesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
