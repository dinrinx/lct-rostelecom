import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, UserDto, UserRoleDto } from './dto/user.dto';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as unknown as UserRoleDto,
    isActive: user.isActive,
    managerId: user.managerId,
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // currentUserId уже резолвнут DevRoleGuard'ом (dev: канонический email роли
  // или X-Dev-User-Id; keycloak: email из токена).
  async getCurrentUser(currentUserId?: string): Promise<UserDto> {
    if (!currentUserId) {
      throw new UnauthorizedException({
        code: 'AUTH_USER_UNKNOWN',
        message: 'Не удалось определить текущего пользователя (нет X-Dev-Role или токена, либо пользователь не заведён)',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id: currentUserId } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `Пользователь с id "${currentUserId}" не найден` });
    }
    return toUserDto(user);
  }

  async listUsers(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({ orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
    return users.map(toUserDto);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `Пользователь с id "${id}" не найден` });
    }
    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException({ code: 'USER_MANAGER_INVALID', message: 'Пользователь не может быть руководителем сам себе' });
      }
      const manager = await this.prisma.user.findUnique({ where: { id: dto.managerId } });
      if (!manager || manager.role !== 'RUKOVODITEL') {
        throw new BadRequestException({
          code: 'USER_MANAGER_INVALID',
          message: `Руководителем может быть только пользователь с ролью RUKOVODITEL (id "${dto.managerId}")`,
        });
      }
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
      },
    });
    return toUserDto(updated);
  }
}
