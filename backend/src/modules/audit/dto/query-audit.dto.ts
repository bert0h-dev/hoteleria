import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class QueryAuditDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca en la descripción' })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  search?: string;

  @ApiPropertyOptional({ example: 'reservation' })
  @IsOptional()
  @IsString({ message: 'El tipo de registro debe ser texto' })
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'El registro debe ser texto' })
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'El usuario no es válido' })
  actorId?: string;

  @ApiPropertyOptional({ description: 'Desde (fecha y hora ISO)' })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha inicial no es válida' })
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta, sin incluir (fecha y hora ISO)' })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha final no es válida' })
  to?: string;
}
