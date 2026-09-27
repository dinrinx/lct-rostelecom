import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DevLoginDto, AuthSessionDto } from './dto/auth-session.dto';
import { UserDto } from './dto/user.dto';
import { AUTH_SESSION_FIXTURE } from './fixtures/auth.fixtures';
import { Roles } from './decorators/roles.decorator';
import { UserRoleDto } from './dto/user.dto';
import type { RequestWithDevRole } from './guards/dev-role.guard';

const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('dev-login')
  @ApiOperation({ summary: 'Dev-авторизация по роли (AUTH_MODE=dev, без Keycloak)' })
  @ApiBody({ type: DevLoginDto })
  @ApiOkResponse({ type: AuthSessionDto })
  devLogin(@Body() _dto: DevLoginDto): AuthSessionDto {
    return AUTH_SESSION_FIXTURE;
  }

  @Get('me')
  @ApiOperation({ summary: 'Текущий пользователь по заголовку X-Dev-Role' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiOkResponse({ type: UserDto })
  @Roles(...ANY_ROLE)
  getCurrentUser(@Req() request: RequestWithDevRole): Promise<UserDto> {
    return this.authService.getCurrentUser(request.currentUserId);
  }

  // Справочник сотрудников для всех ролей: интерфейсу нужны ФИО ответственных,
  // авторов переходов и список КАМов команды (для фильтров и переназначения).
  // Изменение пользователей — только через /admin/users (Администратор).
  @Get('users')
  @ApiOperation({ summary: 'Справочник сотрудников (ФИО, роль, руководитель) — только чтение' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiOkResponse({ type: UserDto, isArray: true })
  @Roles(...ANY_ROLE)
  getUsers(): Promise<UserDto[]> {
    return this.authService.listUsers();
  }
}
