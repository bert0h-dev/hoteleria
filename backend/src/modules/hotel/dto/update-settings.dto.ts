import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    example: 15,
    description: 'Tarifa por hora: % del precio por noche',
  })
  @IsOptional()
  @IsInt({ message: 'El porcentaje por hora debe ser un número entero' })
  @Min(1, { message: 'El porcentaje por hora debe ser al menos 1 %' })
  @Max(100, { message: 'El porcentaje por hora no puede pasar de 100 %' })
  hourlyRatePercent?: number;

  @ApiPropertyOptional({ example: 3, description: 'Mínimo de horas a cobrar' })
  @IsOptional()
  @IsInt({ message: 'El mínimo de horas debe ser un número entero' })
  @Min(1, { message: 'El mínimo de horas debe ser al menos 1' })
  @Max(24, { message: 'El mínimo de horas no puede pasar de 24' })
  minHours?: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Tarifa por día: % del precio por noche',
  })
  @IsOptional()
  @IsInt({ message: 'El porcentaje por día debe ser un número entero' })
  @Min(1, { message: 'El porcentaje por día debe ser al menos 1 %' })
  @Max(500, { message: 'El porcentaje por día no puede pasar de 500 %' })
  dayRatePercent?: number;

  @ApiPropertyOptional({ example: 24, description: 'Duración del día (horas)' })
  @IsOptional()
  @IsInt({ message: 'La duración del día debe ser un número entero de horas' })
  @Min(1, { message: 'La duración del día debe ser al menos 1 hora' })
  @Max(72, { message: 'La duración del día no puede pasar de 72 horas' })
  dayDurationHours?: number;

  @ApiPropertyOptional({
    example: 600,
    description: 'Tarifa por semana: % del precio por noche (600 = 6 noches)',
  })
  @IsOptional()
  @IsInt({ message: 'El porcentaje semanal debe ser un número entero' })
  @Min(100, { message: 'La semana debe costar al menos 1 noche (100 %)' })
  @Max(700, { message: 'La semana no puede costar más de 7 noches (700 %)' })
  weekRatePercent?: number;

  @ApiPropertyOptional({ example: '15:00' })
  @IsOptional()
  @Matches(HH_MM, {
    message: 'La hora de entrada debe tener el formato HH:mm (ej. 15:00)',
  })
  checkInTime?: string;

  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional()
  @Matches(HH_MM, {
    message: 'La hora de salida debe tener el formato HH:mm (ej. 12:00)',
  })
  checkOutTime?: string;

  @ApiPropertyOptional({
    description: 'Si las horas cuestan más que el día, se cobra el día',
  })
  @IsOptional()
  @IsBoolean({ message: 'El tope por hora debe ser verdadero o falso' })
  capHourlyAtDayRate?: boolean;

  @ApiPropertyOptional({
    example: 16,
    description: 'IVA incluido en precios (%)',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El IVA debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El IVA no puede ser negativo' })
  @Max(30, { message: 'El IVA no puede pasar de 30 %' })
  vatPercent?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'ISH incluido en precios (%)',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El ISH debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El ISH no puede ser negativo' })
  @Max(10, { message: 'El ISH no puede pasar de 10 %' })
  lodgingTaxPercent?: number;

  @ApiPropertyOptional({ example: 12, description: 'Edad máxima de niño' })
  @IsOptional()
  @IsInt({ message: 'La edad de niño debe ser un número entero' })
  @Min(0, { message: 'La edad de niño no puede ser negativa' })
  @Max(17, { message: 'La edad de niño no puede pasar de 17 años' })
  childMaxAge?: number;

  @ApiPropertyOptional({
    example: [5, 6],
    description: 'Días con ajuste (0 = domingo … 6 = sábado)',
  })
  @IsOptional()
  @IsArray({ message: 'Los días deben ser una lista' })
  @ArrayUnique({ message: 'Hay días repetidos' })
  @IsInt({ each: true, message: 'Los días deben ser números del 0 al 6' })
  @Min(0, { each: true, message: 'Los días deben ser números del 0 al 6' })
  @Max(6, { each: true, message: 'Los días deben ser números del 0 al 6' })
  weekdayAdjustDays?: number[];

  @ApiPropertyOptional({
    example: 15,
    description: 'Ajuste en % para esos días',
  })
  @IsOptional()
  @IsInt({ message: 'El ajuste por día debe ser un porcentaje entero' })
  @Min(-90, { message: 'El descuento por día no puede pasar de 90 %' })
  @Max(300, { message: 'El aumento por día no puede pasar de 300 %' })
  weekdayAdjustPercent?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Tope de descuento sin autorización (% de la cuenta)',
  })
  @IsOptional()
  @IsInt({ message: 'El tope de descuento debe ser un porcentaje entero' })
  @Min(0, { message: 'El tope de descuento no puede ser negativo' })
  @Max(100, { message: 'El tope de descuento no puede pasar de 100 %' })
  discountCapPercent?: number;

  @ApiPropertyOptional({ example: 'A', description: 'Serie de los recibos' })
  @IsOptional()
  @Matches(/^[A-Z]{1,5}$/, {
    message: 'La serie debe tener de 1 a 5 letras mayúsculas (ej. A)',
  })
  receiptSeries?: string;
}
