import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../generated/prisma/enums.js';

export const PASSWORD_MIN_LENGTH = 8;

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
}
