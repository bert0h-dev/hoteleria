import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../../generated/prisma/enums.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o correo' })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  search?: string;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role, { message: 'El rol no es válido' })
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'El estado debe ser true o false' })
  isActive?: boolean;
}
