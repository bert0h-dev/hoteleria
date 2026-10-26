import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ReservationSource,
  ReservationStatus,
  StayModality,
} from '../../../generated/prisma/enums.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Fechas, modalidad y personas: lo necesario para cotizar. */
export class StayDto {
  @ApiProperty({ enum: StayModality, enumName: 'StayModality' })
  @IsEnum(StayModality, { message: 'La modalidad no es válida' })
  modality: StayModality;

  @ApiProperty({ example: '2026-11-10', description: 'Fecha de llegada' })
  @Matches(DATE_ONLY, {
    message: 'La fecha de llegada debe tener el formato AAAA-MM-DD',
  })
  arrivalDate: string;

  @ApiPropertyOptional({
    example: '2026-11-13',
    description: 'Solo por noche: fecha de salida',
  })
  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'La fecha de salida debe tener el formato AAAA-MM-DD',
  })
  departureDate?: string;

  @ApiPropertyOptional({
    example: '10:30',
    description: 'Por día u horas: hora de entrada',
  })
  @IsOptional()
  @Matches(HH_MM, {
    message: 'La hora de entrada debe tener el formato HH:mm',
  })
  arrivalTime?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Por día: días; por horas: horas',
  })
  @IsOptional()
  @IsInt({ message: 'La duración debe ser un número entero' })
  @Min(1, { message: 'La duración debe ser al menos 1' })
  @Max(72, { message: 'La duración no puede pasar de 72' })
  units?: number;

  @ApiProperty({ example: 2 })
  @IsInt({ message: 'Los adultos deben ser un número entero' })
  @Min(1, { message: 'Debe haber al menos 1 adulto' })
  @Max(20, { message: 'No pueden ser más de 20 adultos' })
  adults: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt({ message: 'Los niños deben ser un número entero' })
  @Min(0, { message: 'Los niños no pueden ser negativos' })
  @Max(20, { message: 'No pueden ser más de 20 niños' })
  children?: number;
}

export class CreateReservationDto extends StayDto {
  @ApiProperty()
  @IsUUID('4', { message: 'El huésped no es válido' })
  guestId: string;

  @ApiProperty()
  @IsUUID('4', { message: 'El tipo de habitación no es válido' })
  roomTypeId: string;

  @ApiProperty({ enum: ReservationSource, enumName: 'ReservationSource' })
  @IsEnum(ReservationSource, { message: 'El origen no es válido' })
  source: ReservationSource;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: '"Requiere anticipo" debe ser verdadero o falso' })
  requiresDeposit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(1000, { message: 'Las notas no pueden pasar de 1000 caracteres' })
  notes?: string | null;

  @ApiPropertyOptional({
    description: 'Datos fiscales del huésped para facturar',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Los datos fiscales no son válidos' })
  taxProfileId?: string | null;
}

export class UpdateReservationDto extends PartialType(CreateReservationDto) {}

export class CancelReservationDto {
  @ApiProperty({ example: 'El huésped canceló por teléfono' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'Indica el motivo de la cancelación' })
  @IsNotEmpty({ message: 'Indica el motivo de la cancelación' })
  reason: string;
}

export class QueryReservationsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Folio o nombre / teléfono del huésped' })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  search?: string;

  @ApiPropertyOptional({
    enum: ReservationStatus,
    enumName: 'ReservationStatus',
  })
  @IsOptional()
  @IsEnum(ReservationStatus, { message: 'El estado no es válido' })
  status?: ReservationStatus;

  @ApiPropertyOptional({
    enum: ReservationSource,
    enumName: 'ReservationSource',
  })
  @IsOptional()
  @IsEnum(ReservationSource, { message: 'El origen no es válido' })
  source?: ReservationSource;

  @ApiPropertyOptional({
    description: 'Llegadas desde esta fecha (AAAA-MM-DD)',
  })
  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'La fecha "desde" debe tener el formato AAAA-MM-DD',
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'Llegadas hasta esta fecha (AAAA-MM-DD)',
  })
  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'La fecha "hasta" debe tener el formato AAAA-MM-DD',
  })
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'El huésped no es válido' })
  guestId?: string;
}

export class CalendarQueryDto {
  @ApiProperty({ example: '2026-11-01' })
  @Matches(DATE_ONLY, {
    message: 'La fecha inicial debe tener el formato AAAA-MM-DD',
  })
  from: string;

  @ApiPropertyOptional({ example: 14, default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días deben ser un número entero' })
  @Min(1, { message: 'Muestra al menos 1 día' })
  @Max(62, { message: 'Muestra como máximo 62 días' })
  days: number = 14;
}
