import { SetMetadata } from '@nestjs/common';
import { UserRoleDto } from '../dto/user.dto';

export const ROLES_KEY = 'roles';

// Роли, которым разрешён доступ к эндпоинту; проверяется DevRoleGuard
// по заголовку X-Dev-Role, пока не подключён реальный Keycloak.
export const Roles = (...roles: UserRoleDto[]) => SetMetadata(ROLES_KEY, roles);
