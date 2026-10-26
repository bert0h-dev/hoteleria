import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MinLength } from 'class-validator';

/** Autorización con PIN (se manda junto con la operación que la requiere). */
export class AuthorizationDto {
  @ApiProperty({ description: 'Usuario que autoriza' })
  @IsUUID('4', { message: 'Elige quién autoriza' })
  authorizerId: string;

  @ApiProperty({ example: '4821' })
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe tener de 4 a 6 dígitos' })
  pin: string;
}

export class SetPinDto {
  @ApiProperty()
  @IsString({ message: 'Escribe tu contraseña actual' })
  @MinLength(1, { message: 'Escribe tu contraseña actual' })
  currentPassword: string;

  @ApiProperty({ example: '4821' })
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe tener de 4 a 6 dígitos' })
  pin: string;
}
