import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../generated/prisma/enums.js';

export const PASSWORD_MIN_LENGTH = 8;

// Convierte '' en null para poder borrar campos opcionales.
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateUserDto {
  @ApiProperty({ example: 'Ana López' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres' })
  name: string;

  @ApiProperty({ example: 'ana@mihotel.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo no es válido' })
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(128, {
    message: 'La contraseña no puede pasar de 128 caracteres',
  })
  password: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  @IsEnum(Role, { message: 'El rol no es válido' })
  role: Role;

  @ApiPropertyOptional({ example: '998 123 4567' })
  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^[0-9+()\s-]{7,20}$/, {
    message:
      'El teléfono solo puede tener números, espacios, +, ( ) y guiones (7 a 20 caracteres)',
  })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'EMP-014' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @IsString({ message: 'El número de empleado debe ser texto' })
  @MaxLength(20, {
    message: 'El número de empleado no puede pasar de 20 caracteres',
  })
  employeeNumber?: string | null;

  @ApiPropertyOptional({ example: '2024-03-15' })
  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de ingreso debe tener el formato AAAA-MM-DD',
  })
  hireDate?: string | null;
}
