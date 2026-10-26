import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogsModule } from './modules/catalogs/catalogs.module.js';
import { GuestsModule } from './modules/guests/guests.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HotelModule } from './modules/hotel/hotel.module.js';
import { RoomTypesModule } from './modules/room-types/room-types.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Límite general: 100 peticiones por minuto por IP.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      // Las pruebas automatizadas hacen muchos logins seguidos.
      skipIf: () => process.env['NODE_ENV'] === 'test',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HotelModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    CatalogsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
