import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { DashboardController } from './dashboard.controller';
import { ReportsService } from './reports.service';
import { CatalogScopeInterceptor } from '../catalogs/catalog-scope.interceptor';

// CatalogScopeInterceptor переиспользуется из catalogs (та же построчная
// видимость по University.kamId, что и в workflow) — см. workflow.module.ts
// за тем же паттерном.
@Module({
  controllers: [ReportsController, DashboardController],
  providers: [ReportsService, CatalogScopeInterceptor],
})
export class ReportsModule {}
