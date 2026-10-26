import { Module } from '@nestjs/common';
import { CatalogsController } from './catalogs.controller.js';

@Module({
  controllers: [CatalogsController],
})
export class CatalogsModule {}
