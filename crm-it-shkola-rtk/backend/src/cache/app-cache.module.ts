import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppCacheService } from './app-cache.service';
import { CacheInvalidationInterceptor } from './cache-invalidation.interceptor';
import { ReadCacheInterceptor } from './read-cache.interceptor';

@Global()
@Module({
  providers: [
    AppCacheService,
    ReadCacheInterceptor,
    { provide: APP_INTERCEPTOR, useClass: CacheInvalidationInterceptor },
  ],
  exports: [AppCacheService, ReadCacheInterceptor],
})
export class AppCacheModule {}
