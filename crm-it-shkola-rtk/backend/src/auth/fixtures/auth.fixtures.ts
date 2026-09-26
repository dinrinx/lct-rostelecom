import { AuthSessionDto } from '../dto/auth-session.dto';
import { UserDto, UserRoleDto } from '../dto/user.dto';

export const CURRENT_USER_FIXTURE: UserDto = {
  id: 'c0000000-0000-4000-8000-000000000001',
  email: 'kam@it-shkola-rtk.ru',
  fullName: 'Иванова Мария Сергеевна',
  role: UserRoleDto.KAM,
  isActive: true,
  managerId: 'c0000000-0000-4000-8000-000000000002',
};

export const USER_FIXTURES: UserDto[] = [
  CURRENT_USER_FIXTURE,
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    email: 'rukovoditel@it-shkola-rtk.ru',
    fullName: 'Петров Сергей Николаевич',
    role: UserRoleDto.RUKOVODITEL,
    isActive: true,
    managerId: null,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000003',
    email: 'admin@it-shkola-rtk.ru',
    fullName: 'Администратор Платформы',
    role: UserRoleDto.ADMINISTRATOR,
    isActive: true,
    managerId: null,
  },
];

export const AUTH_SESSION_FIXTURE: AuthSessionDto = {
  accessToken: 'dev.eyJhbGciOiJIUzI1NiJ9.stub-access-token',
  expiresIn: 3600,
  user: CURRENT_USER_FIXTURE,
};
