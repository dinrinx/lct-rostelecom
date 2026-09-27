import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { CatalogScopeInterceptor } from '../catalogs/catalog-scope.interceptor';

// CatalogScopeInterceptor переиспользуется из catalogs — построчная видимость
// "КАМ видит своё, Руководитель — команду, Админ — всё" одна и та же для
// каталогов и для workflow-инстансов (оба завязаны на University.kamId),
// дублировать этот расчёт незачем. Задаётся отдельным provider'ом здесь же,
// т.к. Nest резолвит класс интерцептора через контейнер модуля, которому
// принадлежит контроллер, а не модуля, где он изначально объявлен.
@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService, CatalogScopeInterceptor],
})
export class WorkflowModule {}
