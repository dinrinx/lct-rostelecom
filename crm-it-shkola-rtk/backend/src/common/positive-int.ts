import { BadRequestException } from '@nestjs/common';

// Строгий парсинг положительного целого из query-параметра: не переданный ->
// undefined (пусть вызывающий код подставит дефолт), переданный, но не
// положительное целое ("abc", "-1", "0", "1.5") -> 400 VALIDATION_ERROR,
// а не молчаливый дефолт (см. catalogs.service.ts/page,pageSize).
export function parsePositiveInt(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Параметр "${name}" должен быть положительным целым числом (получено "${raw}")`,
    });
  }
  return Number(raw);
}
