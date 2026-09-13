import { ConfigService } from '@nestjs/config';
import { getKeycloakConfig } from '@config/keycloak.config';
import { PolicyEnforcementMode, TokenValidation } from 'nest-keycloak-connect';

describe('getKeycloakConfig', () => {
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    };
  });

  it('should return keycloak configuration based on environment variables', () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      const config: Record<string, string> = {
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'my-realm',
        KEYCLOAK_CLIENT_ID: 'my-client',
        KEYCLOAK_SECRET: 'my-secret',
      };
      return config[key];
    });

    const config = getKeycloakConfig(mockConfigService as ConfigService);

    expect(config).toEqual({
      authServerUrl: 'http://localhost:8080',
      realm: 'my-realm',
      clientId: 'my-client',
      secret: 'my-secret',
      policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
      tokenValidation: TokenValidation.OFFLINE,
    });
  });

  it('should return empty string for secret if KEYCLOAK_SECRET is missing', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'KEYCLOAK_SECRET') return undefined;
      return 'value';
    });
    const config = getKeycloakConfig(mockConfigService as ConfigService);
    expect(config.secret).toBe('');
  });
});
