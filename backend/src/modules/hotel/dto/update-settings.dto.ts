import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    example: 15,
    description: 'Tarifa por hora: % del precio por noche',
  })
  @IsOptional()
  @IsInt({ message: 'El porcentaje por hora debe ser un número entero' })
  @Min(1, { message: 'El porcentaje por hora debe ser al menos 1 %' })
  @Max(100, { message: 'El porcentaje por hora no puede pasar de 100 %' })
  hourlyRatePercent?: number;

  @ApiPropertyOptional({ example: 3, description: 'Mínimo de horas a cobrar' })
  @IsOptional()
  @IsInt({ message: 'El mínimo de horas debe ser un número entero' })
  @Min(1, { message: 'El mínimo de horas debe ser al menos 1' })
  @Max(24, { message: 'El mínimo de horas no puede pasar de 24' })
  minHours?: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Tarifa por día: % del precio por noche',
  })
  @IsOptional()
  @IsInt({ message: 'El porcentaje por día debe ser un número entero' })
  @Min(1, { message: 'El porcentaje por día debe ser al menos 1 %' })
  @Max(500, { message: 'El porcentaje por día no puede pasar de 500 %' })
  dayRatePercent?: number;

  @ApiPropertyOptional({ example: 24, description: 'Duración del día (horas)' })
  @IsOptional()
  @IsInt({ message: 'La duración del día debe ser un número entero de horas' })
  @Min(1, { message: 'La duración del día debe ser al menos 1 hora' })
  @Max(72, { message: 'La duración del día no puede pasar de 72 horas' })
  dayDurationHours?: number;

  @ApiPropertyOptional({
    example: 600,
    description: 'Tarifa por semana: % del precio por noche (600 = 6 noches)',
  })
  @IsOptional()
  @IsInt({ message: 'El porcentaje semanal debe ser un número entero' })
  @Min(100, { message: 'La semana debe costar al menos 1 noche (100 %)' })
  @Max(700, { message: 'La semana no puede costar más de 7 noches (700 %)' })
  weekRatePercent?: number;

  @ApiPropertyOptional({ example: '15:00' })
  @IsOptional()
  @Matches(HH_MM, {
    message: 'La hora de entrada debe tener el formato HH:mm (ej. 15:00)',
  })
  checkInTime?: string;

  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional()
  @Matches(HH_MM, {
    message: 'La hora de salida debe tener el formato HH:mm (ej. 12:00)',
  })
  checkOutTime?: string;
}
