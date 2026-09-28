import { Body, Controller, Get, Param, Put, Patch } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from './decorators/roles.decorator';
import { UpdateUserDto, UserDto, UserRoleDto } from './dto/user.dto';
import { AuthService } from './auth.service';

// Управление пользователями и ролями поверх локальной модели User (при
// AUTH_MODE=keycloak роль в токене — источник для авторизации запроса, здесь —
// сопоставление и оргструктура: активность, руководитель).
// Доступ только администратору — проверяется DevRoleGuard по @Roles().
@ApiTags('admin')
@ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
@Roles(UserRoleDto.ADMINISTRATOR)
@Controller('admin')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  @ApiOperation({ summary: 'Пользователи и их роли' })
  @ApiOkResponse({ type: UserDto, isArray: true })
  getUsers(): Promise<UserDto[]> {
    return this.authService.listUsers();
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Изменить роль/активность/руководителя пользователя' })
  @ApiParam({ name: 'id', example: 'c0000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserDto })
  patchUpdateUser(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.authService.updateUser(id, dto);
  }

  // Оставлен для совместимости с фронтом: то же поведение, что у PATCH выше.
  @Put('users/:id')
  @ApiOperation({
    deprecated: true, summary: 'Изменить роль/активность/руководителя пользователя' })
  @ApiParam({ name: 'id', example: 'c0000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserDto })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.authService.updateUser(id, dto);
  }
}
