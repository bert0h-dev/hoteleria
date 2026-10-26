import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Currency, PaymentMethod } from '../../../generated/prisma/enums.js';
import { AuthorizationDto } from '../../auth/dto/authorization.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const money = (label: string) => ({
  message: `${label} debe ser un número con máximo 2 decimales`,
});

// --- Tipo de cambio ---

export class ExchangeRateDto {
  @ApiProperty({ example: 17.2345, description: 'Pesos por dólar' })
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'El tipo de cambio debe ser un número con máximo 4 decimales' },
  )
  @Min(1, { message: 'El tipo de cambio no es válido' })
  @Max(1000, { message: 'El tipo de cambio no es válido' })
  rate: number;
}

// --- Conceptos ---

export class CreateConceptDto {
  @ApiProperty({ example: 'Agua embotellada' })
  @Transform(trim)
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  @IsString({ message: 'Escribe el nombre del concepto' })
  @IsNotEmpty({ message: 'Escribe el nombre del concepto' })
  name: string;

  @ApiPropertyOptional({ example: 'Minibar' })
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(40, { message: 'La categoría no puede pasar de 40 caracteres' })
  @IsString({ message: 'La categoría debe ser texto' })
  category?: string | null;

  @ApiProperty({ example: 35, description: 'Pesos, impuestos incluidos' })
  @IsNumber({ maxDecimalPlaces: 2 }, money('El precio'))
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(1_000_000, { message: 'El precio es demasiado alto' })
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  isActive?: boolean;
}

export class UpdateConceptDto extends PartialType(CreateConceptDto) {}

// --- Folio ---

export class AddChargeDto {
  @ApiPropertyOptional({ description: 'Concepto del catálogo' })
  @IsOptional()
  @IsUUID('4', { message: 'El concepto no es válido' })
  conceptId?: string;

  @ApiPropertyOptional({ description: 'Obligatorio si no hay concepto' })
  @IsOptional()
  @Transform(trim)
  @MaxLength(120, {
    message: 'La descripción no puede pasar de 120 caracteres',
  })
  @IsString({ message: 'La descripción debe ser texto' })
  description?: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  @Max(999, { message: 'La cantidad no puede pasar de 999' })
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Pesos por unidad; si no, el del concepto',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, money('El precio'))
  @Min(0.01, { message: 'El precio debe ser mayor a 0' })
  @Max(1_000_000, { message: 'El precio es demasiado alto' })
  unitPrice?: number;
}

/** Autorización opcional (cuando la operación pasa el tope). */
class WithAuthorization {
  @ApiPropertyOptional({ type: AuthorizationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthorizationDto)
  authorization?: AuthorizationDto;
}

export class AddDiscountDto extends WithAuthorization {
  @ApiPropertyOptional({ example: 200, description: 'Monto en pesos' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, money('El descuento'))
  @Min(0.01, { message: 'El descuento debe ser mayor a 0' })
  amount?: number;

  @ApiPropertyOptional({ example: 10, description: '% de la cuenta' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, money('El porcentaje'))
  @Min(0.01, { message: 'El porcentaje debe ser mayor a 0' })
  @Max(100, { message: 'El porcentaje no puede pasar de 100' })
  percent?: number;

  @ApiProperty({ example: 'Cliente frecuente' })
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'Indica el motivo del descuento' })
  @IsNotEmpty({ message: 'Indica el motivo del descuento' })
  reason: string;
}

export class ResolveStayChargeDto extends WithAuthorization {
  @ApiProperty({ enum: ['CONFIRM', 'WAIVE'] })
  @IsIn(['CONFIRM', 'WAIVE'], {
    message: 'La acción debe ser confirmar o condonar',
  })
  action: 'CONFIRM' | 'WAIVE';

  @ApiPropertyOptional({ description: 'Obligatorio al condonar' })
  @IsOptional()
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'El motivo debe ser texto' })
  reason?: string;
}

export class PaymentDto {
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsEnum(PaymentMethod, { message: 'El método de pago no es válido' })
  method: PaymentMethod;

  @ApiPropertyOptional({ enum: Currency, enumName: 'Currency', default: 'MXN' })
  @IsOptional()
  @IsEnum(Currency, { message: 'La moneda no es válida' })
  currency?: Currency;

  @ApiProperty({ example: 1500, description: 'Monto en la moneda del pago' })
  @IsNumber({ maxDecimalPlaces: 2 }, money('El monto'))
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  @Max(10_000_000, { message: 'El monto es demasiado alto' })
  amount: number;

  @ApiPropertyOptional({
    example: '4521',
    description: 'Referencia o últimos 4 dígitos',
  })
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(60, { message: 'La referencia no puede pasar de 60 caracteres' })
  @IsString({ message: 'La referencia debe ser texto' })
  reference?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(300, { message: 'Las notas no pueden pasar de 300 caracteres' })
  @IsString({ message: 'Las notas deben ser texto' })
  notes?: string | null;
}

export class RefundDto {
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsEnum(PaymentMethod, { message: 'El método no es válido' })
  method: PaymentMethod;

  @ApiProperty({ example: 200 })
  @IsNumber({ maxDecimalPlaces: 2 }, money('El monto'))
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount: number;

  @ApiProperty()
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'Indica el motivo de la devolución' })
  @IsNotEmpty({ message: 'Indica el motivo de la devolución' })
  reason: string;
}

export class VoidDto {
  @ApiProperty()
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'Indica el motivo de la cancelación' })
  @IsNotEmpty({ message: 'Indica el motivo de la cancelación' })
  reason: string;
}

/** Check-out con saldo pendiente: motivo y, si hace falta, autorización. */
export class CheckOutDto extends WithAuthorization {
  @ApiPropertyOptional({ description: 'Obligatorio si queda saldo pendiente' })
  @IsOptional()
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'El motivo debe ser texto' })
  balanceReason?: string;
}
