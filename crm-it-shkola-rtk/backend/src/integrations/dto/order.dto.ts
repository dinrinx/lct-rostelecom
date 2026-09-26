import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Маппинг полей внешней заявки (см. backend/fixtures/integrations/orders.json)
// на camelCase-поля контракта — единственный источник истины для фронта и бэка:
//
//   Номер заявки     -> externalId
//   Курс             -> course
//   Фамилия          -> lastName
//   Имя              -> firstName
//   Отчество         -> middleName
//   Телефон          -> phone
//   Email            -> email
//   Номер потока     -> cohortNumber
export class OrderDto {
  @ApiProperty({ example: 'ORD-2026-000145' })
  externalId!: string;

  @ApiProperty({ example: 'Базис Dynamix: администрирование СУБД' })
  course!: string;

  @ApiProperty({ example: 'Смирнова' })
  lastName!: string;

  @ApiProperty({ example: 'Анна' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Петровна' })
  middleName?: string | null;

  @ApiProperty({ example: '+7 (911) 222-33-44' })
  phone!: string;

  @ApiProperty({ example: 'smirnova.ap@example.ru' })
  email!: string;

  @ApiProperty({ example: 12 })
  cohortNumber!: number;
}
