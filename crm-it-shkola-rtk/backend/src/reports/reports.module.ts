import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { DashboardController } from './dashboard.controller';
import { ReportsService } from './reports.service';
import { CatalogScopeInterceptor } from '../catalogs/catalog-scope.interceptor';

@Module({
  controllers: [ReportsController, DashboardController],
  providers: [ReportsService, CatalogScopeInterceptor],
})
export class ReportsModule {}
