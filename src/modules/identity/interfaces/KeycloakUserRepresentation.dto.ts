export interface KeycloakUserRepresentation {
  username: string;
  email: string;
  enabled: boolean;
  credentials: { type: 'password'; value: string; temporary: boolean }[];
  attributes?: Record<string, string[]>;
}
