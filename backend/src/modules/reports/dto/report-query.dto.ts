import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_ONLY, {
    message: 'La fecha inicial debe tener el formato AAAA-MM-DD',
  })
  from: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_ONLY, {
    message: 'La fecha final debe tener el formato AAAA-MM-DD',
  })
  to: string;
}
