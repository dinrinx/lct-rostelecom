import { Module } from '@nestjs/common';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { CatalogScopeInterceptor } from './catalog-scope.interceptor';
import { UniversityImportService } from './import/university-import.service';

@Module({
  controllers: [CatalogsController],
  providers: [CatalogsService, CatalogScopeInterceptor, UniversityImportService],
})
export class CatalogsModule {}
