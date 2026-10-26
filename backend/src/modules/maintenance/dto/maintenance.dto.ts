import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { TicketPriority } from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateTicketDto {
  @ApiPropertyOptional({ description: 'Habitación; si no, indica el área' })
  @IsOptional()
  @IsUUID('4', { message: 'La habitación no es válida' })
  roomId?: string | null;

  @ApiPropertyOptional({ example: 'Lobby' })
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(80, { message: 'El área no puede pasar de 80 caracteres' })
  @IsString({ message: 'El área debe ser texto' })
  area?: string | null;

  @ApiProperty({ example: 'Fuga en el lavabo' })
  @Transform(trim)
  @MaxLength(500, {
    message: 'La descripción no puede pasar de 500 caracteres',
  })
  @IsString({ message: 'Describe el problema' })
  @IsNotEmpty({ message: 'Describe el problema' })
  description: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(TicketPriority, { message: 'La prioridad no es válida' })
  priority?: TicketPriority;

  @ApiPropertyOptional({ description: 'Pasa la habitación a Mantenimiento' })
  @IsOptional()
  @IsBoolean({ message: 'El bloqueo debe ser verdadero o falso' })
  blocksRoom?: boolean;

  @ApiPropertyOptional({ example: '2026-10-28' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha estimada debe tener el formato AAAA-MM-DD',
  })
  blockedUntil?: string;
}

export class ResolveTicketDto {
  @ApiProperty({ example: 'Se cambió el empaque' })
  @Transform(trim)
  @MaxLength(500, { message: 'La solución no puede pasar de 500 caracteres' })
  @IsString({ message: 'Describe la solución' })
  @IsNotEmpty({ message: 'Describe la solución' })
  resolution: string;

  @ApiProperty({ example: 'Plomero Juan' })
  @Transform(trim)
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  @IsString({ message: 'Indica quién lo arregló' })
  @IsNotEmpty({ message: 'Indica quién lo arregló' })
  fixedBy: string;
}

export class CancelTicketDto {
  @ApiProperty()
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'Indica el motivo' })
  @IsNotEmpty({ message: 'Indica el motivo' })
  reason: string;
}

export class QueryTicketsDto {
  @ApiPropertyOptional({ enum: ['open', 'closed'], default: 'open' })
  @IsOptional()
  @IsIn(['open', 'closed'], { message: 'El filtro debe ser open o closed' })
  status?: 'open' | 'closed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'La habitación no es válida' })
  roomId?: string;
}
