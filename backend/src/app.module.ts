import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CashModule } from './modules/cash/cash.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { CleaningModule } from './modules/cleaning/cleaning.module.js';
import { MaintenanceModule } from './modules/maintenance/maintenance.module.js';
import { CatalogsModule } from './modules/catalogs/catalogs.module.js';
import { GuestsModule } from './modules/guests/guests.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RatePeriodsModule } from './modules/rate-periods/rate-periods.module.js';
import { ReservationsModule } from './modules/reservations/reservations.module.js';
import { HotelModule } from './modules/hotel/hotel.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
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
    AuditModule,
    AuthModule,
    UsersModule,
    HotelModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    RatePeriodsModule,
    BillingModule,
    CashModule,
    DashboardModule,
    ReportsModule,
    CleaningModule,
    MaintenanceModule,
    CatalogsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
