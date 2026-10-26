import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const money = (label: string) => ({
  message: `${label} debe ser un número con máximo 2 decimales`,
});

export class OpenShiftDto {
  @ApiPropertyOptional({ example: 1500, description: 'Fondo en pesos' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, money('El fondo en pesos'))
  @Min(0, { message: 'El fondo en pesos no puede ser negativo' })
  @Max(1_000_000, { message: 'El fondo en pesos es demasiado alto' })
  openingMxn?: number;

  @ApiPropertyOptional({ example: 100, description: 'Fondo en dólares' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, money('El fondo en dólares'))
  @Min(0, { message: 'El fondo en dólares no puede ser negativo' })
  @Max(100_000, { message: 'El fondo en dólares es demasiado alto' })
  openingUsd?: number;
}

export class CloseShiftDto {
  @ApiProperty({ example: 3250.5, description: 'Pesos contados' })
  @IsNumber({ maxDecimalPlaces: 2 }, money('El efectivo en pesos'))
  @Min(0, { message: 'El efectivo en pesos no puede ser negativo' })
  @Max(10_000_000, { message: 'El efectivo en pesos es demasiado alto' })
  countedMxn: number;

  @ApiPropertyOptional({ example: 100, description: 'Dólares contados' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, money('El efectivo en dólares'))
  @Min(0, { message: 'El efectivo en dólares no puede ser negativo' })
  @Max(1_000_000, { message: 'El efectivo en dólares es demasiado alto' })
  countedUsd?: number;

  @ApiPropertyOptional({ description: 'Obligatorio si falta efectivo' })
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(500, { message: 'El comentario no puede pasar de 500 caracteres' })
  @IsString({ message: 'El comentario debe ser texto' })
  notes?: string | null;
}

export class QueryShiftsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['open', 'closed'] })
  @IsOptional()
  @IsIn(['open', 'closed'], { message: 'El estado debe ser open o closed' })
  status?: 'open' | 'closed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'El usuario no es válido' })
  userId?: string;
}
