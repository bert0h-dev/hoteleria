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
  ValidateIf,
} from 'class-validator';
import { RoomStatus } from '../../../generated/prisma/enums.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateRoomDto {
  @ApiProperty({ example: '101' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'El número debe ser texto' })
  @IsNotEmpty({ message: 'El número de habitación es obligatorio' })
  @MaxLength(10, { message: 'El número no puede pasar de 10 caracteres' })
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'El número solo puede tener letras, números y guiones',
  })
  number: string;

  @ApiProperty({ example: 1 })
  @IsInt({ message: 'El piso debe ser un número entero' })
  @Min(-5, { message: 'El piso no es válido' })
  @Max(200, { message: 'El piso no es válido' })
  floor: number;

  @ApiProperty()
  @IsUUID('4', { message: 'El tipo de habitación no es válido' })
  roomTypeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(500, { message: 'Las notas no pueden pasar de 500 caracteres' })
  notes?: string | null;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
  @ApiPropertyOptional({ description: 'false da de baja la habitación' })
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  isActive?: boolean;
}

export class ChangeRoomStatusDto {
  @ApiProperty({ enum: RoomStatus, enumName: 'RoomStatus' })
  @IsEnum(RoomStatus, { message: 'El estado no es válido' })
  status: RoomStatus;

  @ApiPropertyOptional({ example: 'Fuga en el lavabo' })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  reason?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-28',
    description:
      'Mantenimiento (obligatoria) / Fuera de servicio (opcional): último día bloqueado',
  })
  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'La fecha estimada debe tener el formato AAAA-MM-DD',
  })
  blockedUntil?: string;

  @ApiPropertyOptional({
    description:
      'Al terminar una limpieza: quién limpió (si no se indica, quien hace el cambio)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'La persona de limpieza no es válida' })
  cleanedById?: string;
}

export class UpdateBlockedUntilDto {
  @ApiProperty({
    example: '2026-11-02',
    nullable: true,
    description:
      'Nueva fecha estimada; null = indefinido (solo Fuera de servicio)',
  })
  @ValidateIf((_, value) => value !== null)
  @Matches(DATE_ONLY, {
    message: 'La fecha estimada debe tener el formato AAAA-MM-DD',
  })
  blockedUntil: string | null;
}

export class QueryRoomsDto {
  @ApiPropertyOptional({ description: 'true: solo bloqueos vencidos' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'overdue debe ser true o false' })
  overdue?: boolean;

  @ApiPropertyOptional({ enum: RoomStatus, enumName: 'RoomStatus' })
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'El estado no es válido' })
  status?: RoomStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El piso debe ser un número entero' })
  floor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'El tipo de habitación no es válido' })
  roomTypeId?: string;

  @ApiPropertyOptional({ description: 'Busca por número' })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  search?: string;

  @ApiPropertyOptional({ description: 'true incluye las dadas de baja' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'includeInactive debe ser true o false' })
  includeInactive?: boolean;
}
