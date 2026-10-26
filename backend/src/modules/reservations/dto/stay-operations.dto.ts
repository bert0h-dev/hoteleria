import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CreateReservationDto } from './reservation.dto.js';

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class AssignRoomDto {
  @ApiProperty()
  @IsUUID('4', { message: 'La habitación no es válida' })
  roomId: string;

  @ApiPropertyOptional({
    description:
      'Obligatorio si la habitación es de otro tipo (mejora de categoría)',
  })
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  reason?: string;
}

/** Llegada sin reserva: datos de la reserva + habitación. */
export class WalkInDto extends CreateReservationDto {
  @ApiProperty()
  @IsUUID('4', { message: 'La habitación no es válida' })
  roomId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  reason?: string;
}

export class ExtendStayDto {
  @ApiPropertyOptional({
    example: '2026-11-15',
    description: 'Por noche: nueva fecha de salida',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La nueva salida debe tener el formato AAAA-MM-DD',
  })
  departureDate?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Por día u horas: nueva duración total',
  })
  @IsOptional()
  @IsInt({ message: 'La duración debe ser un número entero' })
  @Min(1, { message: 'La duración debe ser al menos 1' })
  @Max(72, { message: 'La duración no puede pasar de 72' })
  units?: number;
}
