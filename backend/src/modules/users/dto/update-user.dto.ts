import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';

export class UpdateUserDto extends PartialType(
  PickType(CreateUserDto, [
    'name',
    'role',
    'phone',
    'employeeNumber',
    'hireDate',
  ] as const),
) {
  @ApiPropertyOptional({ description: 'false desactiva al usuario' })
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  isActive?: boolean;
}
