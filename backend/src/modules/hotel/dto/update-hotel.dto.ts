import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Convierte '' en null para poder borrar campos opcionales.
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateHotelDto {
  @ApiPropertyOptional({ example: 'Mi Hotel' })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del hotel es obligatorio' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres' })
  name?: string;

  @ApiPropertyOptional({ example: 'Mi Hotel S.A. de C.V.' })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'La razón social debe ser texto' })
  @MaxLength(200, { message: 'La razón social es demasiado larga' })
  legalName?: string | null;

  @ApiPropertyOptional({ example: 'MHO010101ABC' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @IsString({ message: 'El RFC debe ser texto' })
  @MaxLength(13, { message: 'El RFC no puede pasar de 13 caracteres' })
  taxId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'La dirección debe ser texto' })
  @MaxLength(300, { message: 'La dirección es demasiado larga' })
  address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(30, { message: 'El teléfono es demasiado largo' })
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail({}, { message: 'El correo no es válido' })
  email?: string | null;

  @ApiPropertyOptional({ example: 'America/Mexico_City' })
  @IsOptional()
  @IsTimeZone({ message: 'La zona horaria no es válida' })
  timezone?: string;
}
