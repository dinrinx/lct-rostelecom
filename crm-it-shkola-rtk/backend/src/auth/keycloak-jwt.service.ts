import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { UserRoleDto } from './dto/user.dto';

interface KeycloakTokenPayload extends JWTPayload {
  // Плоский claim "roles" — из protocol mapper client-roles-flat-claim
  // в infra/keycloak/realm-export.json (client roles клиента it-school-crm-backend).
  roles?: string[];
  email?: string;
}

export interface KeycloakAuthResult {
  userRole: UserRoleDto;
  // В access-токене (в отличие от id-токена) "sub" не гарантирован в некоторых
  // конфигурациях scope — не используем его ни для одной RBAC-проверки, поэтому
  // делаем опциональным, а не блокируем логин из-за отсутствующего необязательного поля.
  subject?: string;
  // Матчинг на Prisma User.email для построчного RBAC (см. DevRoleGuard.resolveCurrentUserId).
  email?: string;
}

const ROLE_CLAIM_MAP: Record<string, UserRoleDto> = {
  kam: UserRoleDto.KAM,
  rukovoditel: UserRoleDto.RUKOVODITEL,
  administrator: UserRoleDto.ADMINISTRATOR,
};

// Проверка JWT от Keycloak: подпись — через JWKS (публичные ключи realm'а, jose
// сам кэширует и обновляет при ротации), issuer/audience — по KEYCLOAK_URL/REALM/CLIENT_ID.
// Важно: audience в access-токене появляется только благодаря protocol mapper
// "backend-audience" (oidc-audience-mapper) в realm-export — без него Keycloak по
// умолчанию кладёт в aud "account", а не наш client_id.
@Injectable()
export class KeycloakJwtService {
  private readonly logger = new Logger(KeycloakJwtService.name);
  private jwks: JWTVerifyGetKey | undefined;

  private getJwks(): JWTVerifyGetKey {
    if (!this.jwks) {
      const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
      const realm = process.env.KEYCLOAK_REALM ?? 'it-school-crm';
      this.jwks = createRemoteJWKSet(new URL(`${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`));
    }
    return this.jwks;
  }

  async verify(token: string): Promise<KeycloakAuthResult> {
    const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM ?? 'it-school-crm';
    const clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'it-school-crm-backend';

    let payload: KeycloakTokenPayload;
    try {
      const result = await jwtVerify<KeycloakTokenPayload>(token, this.getJwks(), {
        issuer: `${keycloakUrl}/realms/${realm}`,
        audience: clientId,
      });
      payload = result.payload;
    } catch (error) {
      this.logger.warn(`JWT verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Токен недействителен, просрочен или выдан не для этого realm/клиента',
      });
    }

    const userRole = (payload.roles ?? []).map((role) => ROLE_CLAIM_MAP[role.toLowerCase()]).find(Boolean);

    if (!userRole) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_NO_ROLE',
        message: 'В claim "roles" токена нет ни одной из ожидаемых ролей (kam|rukovoditel|administrator)',
      });
    }

    return { userRole, subject: payload.sub, email: payload.email };
  }
}
