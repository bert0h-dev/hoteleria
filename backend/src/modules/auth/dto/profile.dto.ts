import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  CreateUserDto,
  PASSWORD_MIN_LENGTH,
} from '../../users/dto/create-user.dto.js';

/** Lo que cada usuario puede cambiar de sí mismo: nombre y teléfono. */
export class UpdateProfileDto extends PartialType(
  PickType(CreateUserDto, ['name', 'phone'] as const),
) {}

export class ChangeOwnPasswordDto {
  @ApiProperty()
  @IsString({ message: 'La contraseña actual debe ser texto' })
  @MinLength(1, { message: 'Escribe tu contraseña actual' })
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString({ message: 'La nueva contraseña debe ser texto' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(128, {
    message: 'La nueva contraseña no puede pasar de 128 caracteres',
  })
  newPassword: string;
}
