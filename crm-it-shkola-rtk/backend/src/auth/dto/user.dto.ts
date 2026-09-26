import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRoleDto {
  KAM = 'KAM',
  RUKOVODITEL = 'RUKOVODITEL',
  ADMINISTRATOR = 'ADMINISTRATOR',
}

export class UserDto {
  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'kam@it-shkola-rtk.ru' })
  email!: string;

  @ApiProperty({ example: 'Иванова Мария Сергеевна' })
  fullName!: string;

  @ApiProperty({ enum: UserRoleDto, example: UserRoleDto.KAM })
  role!: UserRoleDto;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: 'c0000000-0000-4000-8000-000000000002', nullable: true })
  managerId?: string | null;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: UserRoleDto, example: UserRoleDto.RUKOVODITEL })
  role?: UserRoleDto;

  @ApiPropertyOptional({ example: false })
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'c0000000-0000-4000-8000-000000000002', nullable: true })
  managerId?: string | null;
}
