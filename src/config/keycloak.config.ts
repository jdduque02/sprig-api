import {
  KeycloakConnectOptions,
  PolicyEnforcementMode,
  TokenValidation,
} from 'nest-keycloak-connect';
import { ConfigService } from '@nestjs/config';

export const getKeycloakConfig = (
  configService: ConfigService,
): KeycloakConnectOptions => {
  return {
    authServerUrl: configService.get<string>('KEYCLOAK_URL')!,
    realm: configService.get<string>('KEYCLOAK_REALM')!,
    clientId: configService.get<string>('KEYCLOAK_CLIENT_ID')!,
    secret: configService.get<string>('KEYCLOAK_SECRET') || '',
    policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
    tokenValidation: TokenValidation.OFFLINE,
  };
};
