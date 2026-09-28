import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CatalogsModule } from './catalogs/catalogs.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ReportsModule } from './reports/reports.module';
import { FilesModule } from './files/files.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MinioModule } from './storage/minio.module';
import { AppCacheModule } from './cache/app-cache.module';
import { LoggerModule } from 'nestjs-pino';
import { loggerParams } from './observability/logger.config';
import { MetricsModule } from './observability/metrics.module';
import { DevRoleGuard } from './auth/guards/dev-role.guard';

@Module({
  imports: [
    LoggerModule.forRoot(loggerParams),
    MetricsModule,
    PrismaModule,
    RedisModule,
    MinioModule,
    AppCacheModule,
    CatalogsModule,
    WorkflowModule,
    ReportsModule,
    FilesModule,
    IntegrationsModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: DevRoleGuard }],
})
export class AppModule {}
