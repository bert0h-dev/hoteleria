import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ParseUuid } from '../../common/validation/validation-messages.js';
import { BillingService } from './billing.service.js';
import {
  AddChargeDto,
  AddDiscountDto,
  CreateConceptDto,
  ExchangeRateDto,
  PaymentDto,
  RefundDto,
  ResolveStayChargeDto,
  UpdateConceptDto,
  VoidDto,
} from './dto/billing.dto.js';

/** Cobros: ADMIN y RECEPTION; cancelar pagos o movimientos solo ADMIN. */
@ApiTags('Billing')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.RECEPTION)
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // --- Tipo de cambio ---

  @Get('exchange-rates/today')
  todayRate(@CurrentUser() actor: AuthUser) {
    return this.billing.todayRate(actor);
  }

  @Put('exchange-rates/today')
  setTodayRate(@CurrentUser() actor: AuthUser, @Body() dto: ExchangeRateDto) {
    return this.billing.setTodayRate(actor, dto.rate);
  }

  @Get('exchange-rates')
  rateHistory(@CurrentUser() actor: AuthUser) {
    return this.billing.rateHistory(actor);
  }

  // --- Catálogo de conceptos ---

  @Get('charge-concepts')
  concepts(
    @CurrentUser() actor: AuthUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.billing.concepts(actor, includeInactive === 'true');
  }

  @Post('charge-concepts')
  @Roles(Role.ADMIN)
  createConcept(@CurrentUser() actor: AuthUser, @Body() dto: CreateConceptDto) {
    return this.billing.createConcept(actor, dto);
  }

  @Patch('charge-concepts/:id')
  @Roles(Role.ADMIN)
  updateConcept(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateConceptDto,
  ) {
    return this.billing.updateConcept(actor, id, dto);
  }

  // --- Folio ---

  @Get('reservations/:id/folio')
  folio(@CurrentUser() actor: AuthUser, @Param('id', ParseUuid) id: string) {
    return this.billing.folio(actor, id);
  }

  @Post('reservations/:id/folio/charges')
  addCharge(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: AddChargeDto,
  ) {
    return this.billing.addCharge(actor, id, dto);
  }

  @Post('reservations/:id/folio/discounts')
  addDiscount(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: AddDiscountDto,
  ) {
    return this.billing.addDiscount(actor, id, dto);
  }

  @Post('reservations/:id/stay-charges/:chargeId/resolve')
  resolveStayCharge(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Param('chargeId', ParseUuid) chargeId: string,
    @Body() dto: ResolveStayChargeDto,
  ) {
    return this.billing.resolveStayCharge(actor, id, chargeId, dto);
  }

  @Post('reservations/:id/payments')
  addPayment(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: PaymentDto,
  ) {
    return this.billing.addPayment(actor, id, dto);
  }

  @Post('reservations/:id/refunds')
  refund(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Body() dto: RefundDto,
  ) {
    return this.billing.refund(actor, id, dto);
  }

  @Get('reservations/:id/payments/:paymentId/receipt')
  receipt(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Param('paymentId', ParseUuid) paymentId: string,
  ) {
    return this.billing.receipt(actor, id, paymentId);
  }

  @Post('reservations/:id/payments/:paymentId/void')
  @Roles(Role.ADMIN)
  voidPayment(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Param('paymentId', ParseUuid) paymentId: string,
    @Body() dto: VoidDto,
  ) {
    return this.billing.voidPayment(actor, id, paymentId, dto.reason);
  }

  @Post('reservations/:id/folio/entries/:entryId/void')
  @Roles(Role.ADMIN)
  voidEntry(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUuid) id: string,
    @Param('entryId', ParseUuid) entryId: string,
    @Body() dto: VoidDto,
  ) {
    return this.billing.voidEntry(actor, id, entryId, dto.reason);
  }
}
