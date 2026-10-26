import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DocumentType } from '../../../generated/prisma/enums.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Convierte '' en null para poder borrar campos opcionales.
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const upperOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() || null : value;

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY = /^[A-Z]{2}$/;

export class CreateGuestDto {
  @ApiProperty({ example: 'María José' })
  @Transform(trim)
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  firstName: string;

  @ApiProperty({ example: 'Pérez López' })
  @Transform(trim)
  @IsString({ message: 'Los apellidos deben ser texto' })
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(80, { message: 'Los apellidos no pueden pasar de 80 caracteres' })
  lastName: string;

  @ApiPropertyOptional({ example: '1985-04-12' })
  @IsOptional()
  @Transform(trimOrNull)
  @Matches(DATE_ONLY, {
    message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD',
  })
  birthDate?: string | null;

  @ApiPropertyOptional({ example: 'MX', description: 'ISO 3166-1 alfa-2' })
  @IsOptional()
  @Transform(upperOrNull)
  @Matches(COUNTRY, {
    message: 'La nacionalidad debe ser un código de país de 2 letras (MX, US…)',
  })
  nationality?: string | null;

  @ApiPropertyOptional({ example: '998 123 4567' })
  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^[0-9+()\s-]{7,20}$/, {
    message:
      'El teléfono solo puede tener números, espacios, +, ( ) y guiones (7 a 20 caracteres)',
  })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'maria@correo.com' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || null : value,
  )
  @IsEmail({}, { message: 'El correo no es válido' })
  email?: string | null;

  @ApiPropertyOptional({ enum: DocumentType, enumName: 'DocumentType' })
  @IsOptional()
  @IsEnum(DocumentType, { message: 'El tipo de identificación no es válido' })
  documentType?: DocumentType | null;

  @ApiPropertyOptional({ example: 'PEPL850412MQRRPR05' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/\s+/g, '') || null
      : value,
  )
  @IsString({ message: 'El número de identificación debe ser texto' })
  @MaxLength(30, {
    message: 'El número de identificación no puede pasar de 30 caracteres',
  })
  documentNumber?: string | null;

  @ApiPropertyOptional({ example: 'Guadalajara' })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'La ciudad debe ser texto' })
  @MaxLength(80, { message: 'La ciudad no puede pasar de 80 caracteres' })
  city?: string | null;

  @ApiPropertyOptional({ example: 'Jalisco' })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'El estado debe ser texto' })
  @MaxLength(80, { message: 'El estado no puede pasar de 80 caracteres' })
  state?: string | null;

  @ApiPropertyOptional({ example: 'MX' })
  @IsOptional()
  @Transform(upperOrNull)
  @Matches(COUNTRY, {
    message: 'El país debe ser un código de 2 letras (MX, US…)',
  })
  country?: string | null;

  @ApiPropertyOptional({ description: 'Huésped VIP' })
  @IsOptional()
  @IsBoolean({ message: 'VIP debe ser verdadero o falso' })
  isVip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(1000, { message: 'Las notas no pueden pasar de 1000 caracteres' })
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Aceptó el aviso de privacidad' })
  @IsOptional()
  @IsBoolean({ message: 'El aviso de privacidad debe ser verdadero o falso' })
  privacyAccepted?: boolean;
}

export class UpdateGuestDto extends PartialType(CreateGuestDto) {}

export class BlockGuestDto {
  @ApiProperty()
  @IsBoolean({ message: 'El bloqueo debe ser verdadero o falso' })
  isBlocked: boolean;

  @ApiPropertyOptional({ example: 'Daños a la habitación 204' })
  @ValidateIf((dto: BlockGuestDto) => dto.isBlocked)
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'Indica el motivo del bloqueo' })
  @IsNotEmpty({ message: 'Indica el motivo del bloqueo' })
  reason?: string;
}

export class QueryGuestsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Nombre, apellidos, teléfono, correo, identificación o RFC',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'vip debe ser true o false' })
  vip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'blocked debe ser true o false' })
  blocked?: boolean;
}

/** Datos para buscar posibles duplicados antes de crear o editar. */
export class DuplicatesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: DocumentType, enumName: 'DocumentType' })
  @IsOptional()
  @IsEnum(DocumentType, { message: 'El tipo de identificación no es válido' })
  documentType?: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ description: 'Huésped a excluir (al editar)' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  excludeId?: string;
}
