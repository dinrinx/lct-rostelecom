import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host: any = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => (errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)));
  afterEach(() => errorSpy.mockRestore());

  it('доменное исключение с code проходит без изменений', () => {
    const r = run(new NotFoundException({ code: 'X_NOT_FOUND', message: 'нет' }));
    expect(r).toEqual({ status: 404, body: { code: 'X_NOT_FOUND', message: 'нет' } });
  });

  it('стандартное исключение Nest приводится к {code, message}', () => {
    const r = run(new BadRequestException('плохо'));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ code: 'BAD_REQUEST', message: 'плохо' });
  });

  it('неизвестная ошибка -> 500 INTERNAL_ERROR без утечки деталей, стектрейс уходит в лог', () => {
    const error = new Error('внутренняя подробность');
    const r = run(error);
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' });
    expect(errorSpy).toHaveBeenCalledWith('внутренняя подробность', error.stack);
  });

  it('ошибка Prisma не пишет в лог свои аргументы (ФИО/email/телефон) — 152-ФЗ', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Invalid create() data: { fullName: "Иванов Иван", email: "ivanov@secret.ru" }', {
      code: 'P1001',
      clientVersion: 'x',
    });
    const r = run(error);
    expect(r.status).toBe(500);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toMatch(/Иванов|secret\.ru/);
    expect(logged).toMatch(/P1001/);
  });

  it('ошибки Prisma про данные запроса отдаются как 400/404/409 с единой схемой', () => {
    const known = (code: string) => new Prisma.PrismaClientKnownRequestError('m', { code, clientVersion: 'x' });
    expect(run(known('P2002')).status).toBe(409);
    expect(run(known('P2003')).body.code).toBe('FK_CONSTRAINT');
    expect(run(known('P2025')).status).toBe(404);
  });
});
