import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CFDI_USES, TAX_REGIMES } from './sat.js';

@ApiTags('Catalogs')
@ApiBearerAuth()
@Controller('catalogs')
export class CatalogsController {
  /** Regímenes fiscales y usos de CFDI del SAT (para formularios). */
  @Get('sat')
  sat() {
    return { taxRegimes: TAX_REGIMES, cfdiUses: CFDI_USES };
  }
}
