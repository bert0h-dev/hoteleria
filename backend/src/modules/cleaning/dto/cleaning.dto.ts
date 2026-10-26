import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStayoverDto {
  @ApiProperty()
  @IsUUID('4', { message: 'La habitación no es válida' })
  @IsNotEmpty({ message: 'Elige la habitación' })
  roomId: string;

  @ApiPropertyOptional({ description: 'Persona de limpieza asignada' })
  @IsOptional()
  @IsUUID('4', { message: 'La persona asignada no es válida' })
  assignedToId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'La prioridad debe ser verdadero o falso' })
  isPriority?: boolean;

  @ApiPropertyOptional({ example: 'Cambiar toallas' })
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(300, { message: 'La nota no puede pasar de 300 caracteres' })
  @IsString({ message: 'La nota debe ser texto' })
  notes?: string | null;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'null = sin asignar' })
  @IsOptional()
  @IsUUID('4', { message: 'La persona asignada no es válida' })
  assignedToId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'La prioridad debe ser verdadero o falso' })
  isPriority?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(300, { message: 'La nota no puede pasar de 300 caracteres' })
  @IsString({ message: 'La nota debe ser texto' })
  notes?: string | null;
}

export class CancelTaskDto {
  @ApiProperty({ example: 'El huésped no quiso el servicio' })
  @Transform(trim)
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  @IsString({ message: 'Indica el motivo' })
  @IsNotEmpty({ message: 'Indica el motivo' })
  reason: string;
}

export class QueryTasksDto {
  @ApiPropertyOptional({ enum: ['active', 'done'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'done'], { message: 'El filtro debe ser active o done' })
  scope?: 'active' | 'done';
}
