import { ApiProperty } from '@nestjs/swagger';
import { UserDto, UserRoleDto } from './user.dto';

// Dev-авторизация (AUTH_MODE=dev): вместо Keycloak используется заголовок
// X-Dev-Role (kam|rukovoditel|administrator), см. docs/backend-plan.md.
export class DevLoginDto {
  @ApiProperty({ enum: UserRoleDto, example: UserRoleDto.KAM })
  role!: UserRoleDto;
}

export class AuthSessionDto {
  @ApiProperty({ example: 'dev.eyJhbGciOiJIUzI1NiJ9.stub-access-token' })
  accessToken!: string;

  @ApiProperty({ example: 3600 })
  expiresIn!: number;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
