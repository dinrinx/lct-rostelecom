import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DevLoginDto, AuthSessionDto } from './dto/auth-session.dto';
import { UserDto } from './dto/user.dto';
import { AUTH_SESSION_FIXTURE, CURRENT_USER_FIXTURE } from './fixtures/auth.fixtures';

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
  getCurrentUser(@Headers('x-dev-role') _devRole?: string): UserDto {
    return CURRENT_USER_FIXTURE;
  }
}
