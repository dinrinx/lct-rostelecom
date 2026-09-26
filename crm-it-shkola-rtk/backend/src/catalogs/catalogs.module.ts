import { Module } from '@nestjs/common';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { CatalogScopeInterceptor } from './catalog-scope.interceptor';

@Module({
  controllers: [CatalogsController],
  providers: [CatalogsService, CatalogScopeInterceptor],
})
export class CatalogsModule {}
