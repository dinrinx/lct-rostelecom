import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AdminController } from './admin.controller';
import { AuthService } from './auth.service';
import { KeycloakJwtService } from './keycloak-jwt.service';

@Module({
  controllers: [AuthController, AdminController],
  providers: [AuthService, KeycloakJwtService],
  exports: [KeycloakJwtService],
})
export class AuthModule {}
