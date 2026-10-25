import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Amenity } from '../../../generated/prisma/enums.js';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'Doble estándar' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres' })
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(500, {
    message: 'La descripción no puede pasar de 500 caracteres',
  })
  description?: string | null;

  @ApiProperty({ example: 2 })
  @IsInt({ message: 'La capacidad de adultos debe ser un número entero' })
  @Min(1, { message: 'Debe admitir al menos 1 adulto' })
  @Max(20, { message: 'La capacidad de adultos no puede pasar de 20' })
  maxAdults: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt({ message: 'La capacidad de niños debe ser un número entero' })
  @Min(0, { message: 'La capacidad de niños no puede ser negativa' })
  @Max(20, { message: 'La capacidad de niños no puede pasar de 20' })
  maxChildren?: number;

  @ApiProperty({ example: 1000, description: 'Precio por noche en pesos' })
  @IsInt({ message: 'El precio por noche debe ser en pesos enteros' })
  @Min(1, { message: 'El precio por noche debe ser mayor a 0' })
  @Max(1_000_000, { message: 'El precio por noche es demasiado alto' })
  nightlyRate: number;

  @ApiPropertyOptional({ enum: Amenity, enumName: 'Amenity', isArray: true })
  @IsOptional()
  @IsArray({ message: 'Las amenidades deben ser una lista' })
  @ArrayUnique({ message: 'Hay amenidades repetidas' })
  @IsEnum(Amenity, { each: true, message: 'Hay una amenidad no válida' })
  amenities?: Amenity[];
}

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {
  @ApiPropertyOptional({ description: 'false desactiva el tipo' })
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  isActive?: boolean;
}

export class QueryRoomTypesDto {
  @ApiPropertyOptional({ description: 'true incluye los tipos desactivados' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'includeInactive debe ser true o false' })
  includeInactive?: boolean;
}
