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
  @ApiPropertyOptional({ description: 'Puede autorizar con su PIN' })
  @IsOptional()
  @IsBoolean({ message: '"Puede autorizar" debe ser verdadero o falso' })
  canAuthorize?: boolean;

  @ApiPropertyOptional({ description: 'Descuentos sin límite ni autorización' })
  @IsOptional()
  @IsBoolean({ message: '"Descuentos sin límite" debe ser verdadero o falso' })
  canDiscountUnlimited?: boolean;

  @ApiPropertyOptional({ description: 'false desactiva al usuario' })
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  isActive?: boolean;
}
