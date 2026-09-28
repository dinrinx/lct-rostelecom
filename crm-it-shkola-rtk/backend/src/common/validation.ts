import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

// Разворачивает вложенные ошибки class-validator в плоский список
// { field: 'statuses.0.order', errors: [...] } для поля details.
function flatten(errors: ValidationError[], parent = ''): Array<{ field: string; errors: string[] }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, errors: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

// Валидируются только поля, помеченные декораторами class-validator (whitelist
// не включаем — иначе недекорированные поля тихо пропадали бы из запросов).
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    forbidUnknownValues: false,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Некорректные данные запроса',
        details: flatten(errors),
      }),
  });
}
