import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const SEASON_COLORS = [
  'violet',
  'sky',
  'emerald',
  'amber',
  'rose',
  'orange',
  'teal',
  'slate',
] as const;

export class CreateRatePeriodDto {
  @ApiProperty({ example: 'Semana Santa' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(60, { message: 'El nombre no puede pasar de 60 caracteres' })
  @IsString({ message: 'Escribe el nombre de la temporada' })
  @IsNotEmpty({ message: 'Escribe el nombre de la temporada' })
  name: string;

  @ApiProperty({ example: '2027-03-21' })
  @Matches(DATE_ONLY, {
    message: 'La fecha de inicio debe tener el formato AAAA-MM-DD',
  })
  startDate: string;

  @ApiProperty({ example: '2027-04-04' })
  @Matches(DATE_ONLY, {
    message: 'La fecha de fin debe tener el formato AAAA-MM-DD',
  })
  endDate: string;

  @ApiProperty({ example: 30, description: '30 = +30 %, -15 = 15 % menos' })
  @IsInt({ message: 'El ajuste debe ser un porcentaje entero' })
  @Min(-90, { message: 'El descuento no puede pasar de 90 %' })
  @Max(300, { message: 'El aumento no puede pasar de 300 %' })
  adjustmentPercent: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt({ message: 'La prioridad debe ser un número entero' })
  @Min(0, { message: 'La prioridad no puede ser negativa' })
  @Max(100, { message: 'La prioridad no puede pasar de 100' })
  priority?: number;

  @ApiPropertyOptional({ enum: SEASON_COLORS, default: 'violet' })
  @IsOptional()
  @IsIn(SEASON_COLORS, { message: 'El color no es válido' })
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  isActive?: boolean;
}

export class UpdateRatePeriodDto extends PartialType(CreateRatePeriodDto) {}
