import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { AuthController } from '@auth/controller/auth.controller';
import { AuthService } from '@auth/service/auth.service';
import { IpBlockGuard } from '@auth/guards/ip-block.guard';
import { LoginDto } from '@auth/dto/login.dto';
import { RefreshTokenDto } from '@auth/dto/refresh-token.dto';
import { ForgotPasswordDto } from '@auth/dto/forgot-password.dto';
import { VerifyOtpDto } from '@auth/dto/verify-otp.dto';
import { ResetPasswordDto } from '@auth/dto/reset-password.dto';
import { ChangePasswordDto } from '@auth/dto/change-password.dto';
import { EncryptPasswordDto } from '@auth/dto/encrypt-password.dto';

const mockAuthService = {
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
  introspect: jest.fn(),
  verifyOtp: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
  getActiveSessions: jest.fn(),
  revokeSession: jest.fn(),
  getAccessHistory: jest.fn(),
  encryptPassword: jest.fn(),
};

const defaultConfigGet = (key: string, fallback?: string) => fallback;

const mockConfigService = {
  get: jest.fn(defaultConfigGet),
};

const mockI18nService = {
  t: jest.fn((key: string) => key),
};

interface MockRequest {
  headers: Record<string, unknown>;
  cookies: Record<string, string>;
  ip: string;
  socket: { remoteAddress: string };
}

interface MockResponse {
  cookie: jest.Mock;
}

const mockRequest: MockRequest = {
  headers: {},
  cookies: {},
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
};

const mockResponse: MockResponse = {
  cookie: jest.fn(),
};

const tokenResponse = {
  access_token: 'access-jwt',
  refresh_token: 'refresh-jwt',
  expires_in: 300,
  refresh_expires_in: 1800,
  token_type: 'Bearer',
  session_state: 'sess-uuid',
  scope: 'openid',
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    })
      .overrideGuard(IpBlockGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────
  describe('login', () => {
    const dto: LoginDto = { username: 'testuser', password: 'pass123' };

    it('debe retornar KeycloakTokenResponse en login exitoso', async () => {
      mockAuthService.login.mockResolvedValue(tokenResponse);
      const result = await controller.login(dto, mockRequest, mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '127.0.0.1');
      expect(result).toEqual(tokenResponse);
      expect(mockResponse.cookie).toHaveBeenCalled();
    });

    it('debe propagar UnauthorizedException con credenciales inválidas', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Credenciales inválidas.'),
      );
      await expect(
        controller.login(dto, mockRequest, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe propagar InternalServerErrorException en error de Keycloak', async () => {
      mockAuthService.login.mockRejectedValue(
        new InternalServerErrorException(),
      );
      await expect(
        controller.login(dto, mockRequest, mockResponse),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe usar maxAge por defecto si el token no trae expiración', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'a',
        refresh_token: 'r',
      });
      await controller.login(dto, mockRequest, mockResponse);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'cm_access_token',
        'a',
        expect.objectContaining({ maxAge: 300000 }),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'cm_refresh_token',
        'r',
        expect.objectContaining({ maxAge: 1800000 }),
      );
    });

    it('debe usar el primer IP de x-forwarded-for (string)', async () => {
      mockAuthService.login.mockResolvedValue(tokenResponse);
      const req = {
        ...mockRequest,
        headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' },
      };
      await controller.login(dto, req as never, mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '1.1.1.1');
    });

    it('debe usar el primer IP de x-forwarded-for (array)', async () => {
      mockAuthService.login.mockResolvedValue(tokenResponse);
      const req = {
        ...mockRequest,
        headers: { 'x-forwarded-for': ['3.3.3.3', '4.4.4.4'] },
      };
      await controller.login(dto, req as never, mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '3.3.3.3');
    });

    it('debe usar x-real-ip cuando es un string', async () => {
      mockAuthService.login.mockResolvedValue(tokenResponse);
      const req = { ...mockRequest, headers: { 'x-real-ip': '5.5.5.5' } };
      await controller.login(dto, req as never, mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '5.5.5.5');
    });

    it('debe usar x-real-ip cuando es un array', async () => {
      mockAuthService.login.mockResolvedValue(tokenResponse);
      const req = {
        ...mockRequest,
        headers: { 'x-real-ip': ['6.6.6.6', '7.7.7.7'] },
      };
      await controller.login(dto, req as never, mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '6.6.6.6');
    });

    it('debe usar socket.remoteAddress si no hay ip ni headers', async () => {
      mockAuthService.login.mockResolvedValue(tokenResponse);
      const req = { ...mockRequest, headers: {}, ip: undefined };
      await controller.login(dto, req as never, mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '127.0.0.1');
    });

    it('debe devolver unknown si no hay ninguna IP', async () => {
      mockAuthService.login.mockResolvedValue(tokenResponse);
      const req = {
        ...mockRequest,
        headers: {},
        ip: undefined,
        socket: { remoteAddress: undefined },
      };
      await controller.login(dto, req as never, mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, 'unknown');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REFRESH
  // ─────────────────────────────────────────────────────────────
  describe('refresh', () => {
    const dto: RefreshTokenDto = { refresh_token: 'valid-refresh' };

    it('debe retornar nuevos tokens en refresh exitoso', async () => {
      mockAuthService.refresh.mockResolvedValue(tokenResponse);
      const result = await controller.refresh(dto, mockRequest, mockResponse);
      expect(mockAuthService.refresh).toHaveBeenCalledWith({
        refresh_token: 'valid-refresh',
      });
      expect(result).toEqual(tokenResponse);
    });

    it('debe propagar UnauthorizedException si el refresh token es inválido', async () => {
      mockAuthService.refresh.mockRejectedValue(
        new UnauthorizedException('Sesión expirada o token inválido.'),
      );
      await expect(
        controller.refresh(dto, mockRequest, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe propagar InternalServerErrorException en error de Keycloak', async () => {
      mockAuthService.refresh.mockRejectedValue(
        new InternalServerErrorException(),
      );
      await expect(
        controller.refresh(dto, mockRequest, mockResponse),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe usar el refresh token de la cookie si el body no lo trae', async () => {
      mockAuthService.refresh.mockResolvedValue(tokenResponse);
      const req = {
        ...mockRequest,
        cookies: { cm_refresh_token: 'cookie-refresh' },
      };
      const result = await controller.refresh({}, req as never, mockResponse);
      expect(mockAuthService.refresh).toHaveBeenCalledWith({
        refresh_token: 'cookie-refresh',
      });
      expect(result).toEqual(tokenResponse);
    });

    it('debe llamar a refresh con string vacío si no hay ningún token', async () => {
      mockAuthService.refresh.mockResolvedValue(tokenResponse);
      await controller.refresh({}, mockRequest, mockResponse);
      expect(mockAuthService.refresh).toHaveBeenCalledWith({
        refresh_token: '',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────
  describe('logout', () => {
    const dto: RefreshTokenDto = { refresh_token: 'valid-refresh' };

    it('debe cerrar sesión correctamente y retornar undefined', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const result = await controller.logout(dto, mockRequest, mockResponse);
      expect(mockAuthService.logout).toHaveBeenCalledWith(dto.refresh_token);
      expect(result).toBeUndefined();
    });

    it('debe propagar InternalServerErrorException si Keycloak falla', async () => {
      mockAuthService.logout.mockRejectedValue(
        new InternalServerErrorException(),
      );
      await expect(
        controller.logout(dto, mockRequest, mockResponse),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe revocar el refresh token de la cookie cuando el body no lo trae', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const req = {
        ...mockRequest,
        cookies: { cm_refresh_token: 'cookie-refresh' },
      };
      const result = await controller.logout({}, req as never, mockResponse);
      expect(mockAuthService.logout).toHaveBeenCalledWith('cookie-refresh');
      expect(result).toBeUndefined();
    });

    it('debe limpiar las cookies sin llamar a logout si no hay token', async () => {
      mockResponse.cookie.mockClear();
      const result = await controller.logout({}, mockRequest, mockResponse);
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(result).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    const dto: ForgotPasswordDto = { email: 'user@test.com' };

    it('debe enviar email de recuperación y retornar undefined', async () => {
      mockAuthService.forgotPassword.mockResolvedValue(undefined);
      const result = await controller.forgotPassword(dto);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toBeUndefined();
    });

    it('debe propagar la excepción si el email no existe en Keycloak', async () => {
      mockAuthService.forgotPassword.mockRejectedValue(
        new InternalServerErrorException('Error al enviar email.'),
      );
      await expect(controller.forgotPassword(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // INTROSPECT
  // ─────────────────────────────────────────────────────────────
  describe('introspect', () => {
    const introspectResponse = {
      active: true,
      sub: 'user-uuid',
      username: 'testuser',
      email: 'test@test.com',
      expires_in_seconds: 250,
    };

    it('debe retornar IntrospectResponse con token válido', async () => {
      mockAuthService.introspect.mockResolvedValue(introspectResponse);
      const result = await controller.introspect('valid-access-token');
      expect(mockAuthService.introspect).toHaveBeenCalledWith(
        'valid-access-token',
      );
      expect(result.active).toBe(true);
      expect(result.username).toBe('testuser');
    });

    it('debe propagar UnauthorizedException si el token es inválido', async () => {
      mockAuthService.introspect.mockRejectedValue(
        new UnauthorizedException('El token ha expirado o no es válido.'),
      );
      await expect(controller.introspect('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe propagar InternalServerErrorException en error de Keycloak', async () => {
      mockAuthService.introspect.mockRejectedValue(
        new InternalServerErrorException(),
      );
      await expect(controller.introspect('any-token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // VERIFY OTP
  // ─────────────────────────────────────────────────────────────
  describe('verifyOtp', () => {
    const dto: VerifyOtpDto = { email: 'user@test.com', code: '123456' };

    it('debe retornar el reset_token si el código es válido', async () => {
      const response = { reset_token: 'tok', expires_in_seconds: 900 };
      mockAuthService.verifyOtp.mockResolvedValue(response);
      const result = await controller.verifyOtp(dto);
      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(
        'user@test.com',
        '123456',
      );
      expect(result).toEqual(response);
    });

    it('debe propagar BadRequestException si el código es inválido', async () => {
      mockAuthService.verifyOtp.mockRejectedValue(
        new BadRequestException('Código inválido.'),
      );
      await expect(controller.verifyOtp(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // RESET PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    const dto: ResetPasswordDto = {
      email: 'user@test.com',
      reset_token: 'tok',
      new_password: 'Nueva.123',
    };

    it('debe restablecer la contraseña y retornar undefined', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);
      const result = await controller.resetPassword(dto);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        dto.email,
        dto.reset_token,
        dto.new_password,
      );
      expect(result).toBeUndefined();
    });

    it('debe propagar BadRequestException si el token es inválido', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('Token inválido.'),
      );
      await expect(controller.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('changePassword', () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'Vieja.123',
      newPassword: 'Nueva.456',
    };
    const currentUser = { userId: 7 };

    it('debe cambiar la contraseña y devolver mensaje', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);
      const result = await controller.changePassword(dto, currentUser);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('7', dto);
      expect(result).toEqual({ message: 'auth.PASSWORD_CHANGED' });
    });

    it('debe propagar BadRequestException si la contraseña actual es inválida', async () => {
      mockAuthService.changePassword.mockRejectedValue(
        new BadRequestException('Contraseña actual inválida.'),
      );
      await expect(controller.changePassword(dto, currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ACTIVE SESSIONS
  // ─────────────────────────────────────────────────────────────
  describe('getActiveSessions', () => {
    const currentUser = { userId: 7 };
    const sessions = [{ id: 's1' }];

    it('debe listar las sesiones activas del usuario', async () => {
      mockAuthService.getActiveSessions.mockResolvedValue(sessions);
      const result = await controller.getActiveSessions(currentUser);
      expect(mockAuthService.getActiveSessions).toHaveBeenCalledWith('7');
      expect(result).toEqual(sessions);
    });

    it('debe propagar InternalServerErrorException si Keycloak falla', async () => {
      mockAuthService.getActiveSessions.mockRejectedValue(
        new InternalServerErrorException(),
      );
      await expect(controller.getActiveSessions(currentUser)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REVOKE SESSION
  // ─────────────────────────────────────────────────────────────
  describe('revokeSession', () => {
    const currentUser = { userId: 7 };

    it('debe revocar la sesión indicada', async () => {
      mockAuthService.revokeSession.mockResolvedValue(undefined);
      const result = await controller.revokeSession('s1', currentUser);
      expect(mockAuthService.revokeSession).toHaveBeenCalledWith('7', 's1');
      expect(result).toBeUndefined();
    });

    it('debe propagar NotFoundException si la sesión no existe', async () => {
      mockAuthService.revokeSession.mockRejectedValue(
        new NotFoundException('Sesión no encontrada.'),
      );
      await expect(controller.revokeSession('s1', currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ACCESS HISTORY
  // ─────────────────────────────────────────────────────────────
  describe('getAccessHistory', () => {
    const currentUser = { userId: 7 };
    const events = [{ type: 'LOGIN' }];

    it('debe retornar el historial de accesos', async () => {
      mockAuthService.getAccessHistory.mockResolvedValue(events);
      const result = await controller.getAccessHistory(currentUser);
      expect(mockAuthService.getAccessHistory).toHaveBeenCalledWith('7');
      expect(result).toEqual(events);
    });

    it('debe propagar InternalServerErrorException si Keycloak falla', async () => {
      mockAuthService.getAccessHistory.mockRejectedValue(
        new InternalServerErrorException(),
      );
      await expect(controller.getAccessHistory(currentUser)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ENCRYPT PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('encryptPassword', () => {
    const dto: EncryptPasswordDto = { password: 'plain' };

    afterEach(() => {
      mockConfigService.get.mockImplementation(defaultConfigGet);
    });

    it('debe encriptar la contraseña en entornos no productivos', () => {
      mockAuthService.encryptPassword.mockReturnValue('encrypted');
      const result = controller.encryptPassword(dto);
      expect(mockAuthService.encryptPassword).toHaveBeenCalledWith('plain');
      expect(result).toEqual({ encrypted_password: 'encrypted' });
    });

    it('debe lanzar ForbiddenException en PROD sin APP_DEV=true', () => {
      mockConfigService.get.mockImplementation(
        (key: string, fallback?: string) =>
          key === 'AUTH_ENCRYPT_ENABLED' ? 'false' : fallback,
      );
      expect(() => controller.encryptPassword(dto)).toThrow(ForbiddenException);
      expect(mockAuthService.encryptPassword).not.toHaveBeenCalled();
    });

    it('debe permitir encriptar en PROD si APP_DEV=true', () => {
      mockConfigService.get.mockImplementation(
        (key: string, fallback?: string) => {
          if (key === 'AUTH_ENCRYPT_ENABLED') return 'true';
          return fallback;
        },
      );
      mockAuthService.encryptPassword.mockReturnValue('encrypted');
      const result = controller.encryptPassword(dto);
      expect(result).toEqual({ encrypted_password: 'encrypted' });
    });
  });
});
