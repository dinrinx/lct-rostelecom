import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Единая схема ошибок { code, message } (см. CLAUDE.md) поверх стандартных
// кодов Prisma: P2025 — запись не найдена, P2003 — нарушение внешнего ключа
// (используется и при update/delete по несуществующему id, и при ссылке на
// несуществующую связанную сущность).
export function mapPrismaWriteError(error: unknown, notFoundMessage: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: notFoundMessage });
    }
    if (error.code === 'P2003') {
      throw new ConflictException({
        code: 'FK_CONSTRAINT',
        message:
          'Операция нарушает связь с другими записями — проверьте, что связанные сущности существуют и на них ничего не ссылается',
      });
    }
  }
  throw error;
}
