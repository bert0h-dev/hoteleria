import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeRfc } from '../../catalogs/sat.js';

export class CreateTaxProfileDto {
  @ApiProperty({ example: 'GODE561231GR8' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeRfc(value) : value,
  )
  @IsString({ message: 'El RFC debe ser texto' })
  @IsNotEmpty({ message: 'El RFC es obligatorio' })
  rfc: string;

  @ApiProperty({
    example: 'EMPRESA DEMO',
    description: 'Tal como aparece en la constancia (sin "S.A. de C.V.")',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/\s+/g, ' ')
      : value,
  )
  @IsString({ message: 'La razón social debe ser texto' })
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  @MaxLength(254, { message: 'La razón social es demasiado larga' })
  legalName: string;

  @ApiProperty({ example: '612', description: 'Clave c_RegimenFiscal' })
  @IsString({ message: 'El régimen fiscal debe ser texto' })
  @IsNotEmpty({ message: 'El régimen fiscal es obligatorio' })
  taxRegime: string;

  @ApiProperty({ example: '77500', description: 'C.P. del domicilio fiscal' })
  @Matches(/^\d{5}$/, {
    message: 'El código postal fiscal debe tener 5 dígitos',
  })
  zipCode: string;

  @ApiPropertyOptional({ example: 'G03', description: 'Clave c_UsoCFDI' })
  @IsOptional()
  @IsString({ message: 'El uso de CFDI debe ser texto' })
  cfdiUse?: string;

  @ApiPropertyOptional({ example: 'facturas@empresa.com' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || null : value,
  )
  @IsEmail({}, { message: 'El correo para la factura no es válido' })
  invoiceEmail?: string | null;

  @ApiPropertyOptional({ description: 'Usar por defecto al facturar' })
  @IsOptional()
  @IsBoolean({ message: 'Predeterminado debe ser verdadero o falso' })
  isDefault?: boolean;
}

export class UpdateTaxProfileDto extends PartialType(CreateTaxProfileDto) {}
