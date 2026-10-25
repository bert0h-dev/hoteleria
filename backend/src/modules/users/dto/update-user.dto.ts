import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';

export class UpdateUserDto extends PartialType(
  PickType(CreateUserDto, ['name', 'role'] as const),
) {
  @ApiPropertyOptional({ description: 'false desactiva al usuario' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
