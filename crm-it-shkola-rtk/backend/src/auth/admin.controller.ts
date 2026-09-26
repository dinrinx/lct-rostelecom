import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from './decorators/roles.decorator';
import { UpdateUserDto, UserDto, UserRoleDto } from './dto/user.dto';
import { USER_FIXTURES } from './fixtures/auth.fixtures';

// Управление пользователями и ролями. До реального Keycloak (Шаг 1.2) —
// плоский список поверх фикстур; после интеграции источник ролей — Keycloak,
// здесь остаётся только сопоставление с локальной моделью User.
// Доступ только администратору — проверяется DevRoleGuard по @Roles().
@ApiTags('admin')
@ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
@Roles(UserRoleDto.ADMINISTRATOR)
@Controller('admin')
export class AdminController {
  @Get('users')
  @ApiOperation({ summary: 'Пользователи и их роли' })
  @ApiOkResponse({ type: UserDto, isArray: true })
  getUsers(): UserDto[] {
    return USER_FIXTURES;
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Изменить роль/активность/руководителя пользователя' })
  @ApiParam({ name: 'id', example: USER_FIXTURES[0].id })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserDto })
  updateUser(@Param('id') id: string, @Body() _dto: UpdateUserDto): UserDto {
    return USER_FIXTURES.find((user) => user.id === id) ?? USER_FIXTURES[0];
  }
}
