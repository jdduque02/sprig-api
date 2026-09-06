import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { I18nService } from 'nestjs-i18n';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  getSchemaPath,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { BearerToken } from '@auth/decorators/bearer-token.decorator';
import { AuthGuard } from '@auth/guards/auth.guard';
import { IpBlockGuard } from '@auth/guards/ip-block.guard';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { AuthService } from '@auth/service/auth.service';
import { LoginDto } from '@auth/dto/login.dto';
import { RefreshTokenDto } from '@auth/dto/refresh-token.dto';
import { ForgotPasswordDto } from '@auth/dto/forgot-password.dto';
import { ChangePasswordDto } from '@auth/dto/change-password.dto';
import { VerifyOtpDto } from '@auth/dto/verify-otp.dto';
import { VerifyOtpResponseDto } from '@auth/dto/verify-otp-response.dto';
import { ResetPasswordDto } from '@auth/dto/reset-password.dto';
import { SessionResponseDto } from '@auth/dto/session-response.dto';
import { EventResponseDto } from '@auth/dto/event-response.dto';
import { EncryptPasswordDto } from '@auth/dto/encrypt-password.dto';
import { EncryptPasswordResponseDto } from '@auth/dto/encrypt-password-response.dto';
import { KeycloakTokenResponse } from '@auth/interfaces/KeycloakTokenResponse.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAccessCookieOptions,
  clearRefreshCookieOptions,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from '@config/cookie.config';

@ApiTags('auth')
@ApiExtraModels(KeycloakTokenResponse, SessionResponseDto, EventResponseDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  @Post('login')
  @UseGuards(IpBlockGuard)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar usuario y obtener tokens',
    description:
      'Acepta únicamente contraseñas encriptadas con AES-256-GCM (formato iv:authTag:ciphertext). ' +
      'Usar POST /auth/encrypt primero para obtener la contraseña encriptada.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login exitoso.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Operación exitosa' },
        data: {
          type: 'array',
          items: { type: getSchemaPath(KeycloakTokenResponse) },
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2026-04-19T21:38:04.349Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error de comunicación con Keycloak.',
    type: ErrorResponseDto,
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(loginDto, this.extractIp(req));
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('refresh')
  @UseGuards(IpBlockGuard)
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar sesión con refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token renovado exitosamente.',
    type: KeycloakTokenResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token expirado o inválido.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error de comunicación con Keycloak.',
    type: ErrorResponseDto,
  })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieRefresh = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE_NAME
    ];
    const refresh_token = refreshTokenDto?.refresh_token || cookieRefresh || '';
    const tokens = await this.authService.refresh({ refresh_token });
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('logout')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión y revocar tokens' })
  @ApiNoContentResponse({
    description: 'Sesión cerrada. Tokens revocados en Keycloak.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al cerrar sesión en Keycloak.',
    type: ErrorResponseDto,
  })
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieRefresh = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE_NAME
    ];
    const refresh_token = refreshTokenDto?.refresh_token || cookieRefresh || '';
    if (refresh_token) {
      await this.authService.logout(refresh_token);
    }
    res.cookie(
      REFRESH_COOKIE_NAME,
      '',
      clearRefreshCookieOptions(this.configService),
    );
    res.cookie(
      ACCESS_COOKIE_NAME,
      '',
      clearAccessCookieOptions(this.configService),
    );
  }

  private setAuthCookies(res: Response, tokens: KeycloakTokenResponse): void {
    const accessMaxAge = (tokens.expires_in ?? 300) * 1000;
    const refreshMaxAge = (tokens.refresh_expires_in ?? 1800) * 1000;
    res.cookie(
      ACCESS_COOKIE_NAME,
      tokens.access_token,
      getAccessCookieOptions(this.configService, accessMaxAge),
    );
    res.cookie(
      REFRESH_COOKIE_NAME,
      tokens.refresh_token,
      getRefreshCookieOptions(this.configService, refreshMaxAge),
    );
  }

  @Post('forgot-password')
  @UseGuards(IpBlockGuard)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Solicitar reset de contraseña por email' })
  @ApiNoContentResponse({
    description:
      'Email de recuperación enviado (si el usuario existe en Keycloak).',
  })
  @ApiBadRequestResponse({
    description: 'Email inválido.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al enviar email o comunicar con Keycloak.',
    type: ErrorResponseDto,
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
  }

  @Post('verify-otp')
  @UseGuards(IpBlockGuard)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar código OTP de recuperación de contraseña',
    description:
      'Recibe el código enviado por email en POST /auth/forgot-password. ' +
      'En caso de éxito devuelve un reset_token (firma HMAC, válido 15 min) ' +
      'para usar en POST /auth/reset-password. Cada OTP admite 3 intentos.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Código válido. Se devuelve el token de reset.',
    type: VerifyOtpResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Código inválido, expirado o intentos agotados.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al validar el código.',
    type: ErrorResponseDto,
  })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @Post('reset-password')
  @UseGuards(IpBlockGuard)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Restablecer contraseña usando el token de reset (OTP)',
    description:
      'Cambia la contraseña en Keycloak con el reset_token obtenido en ' +
      'POST /auth/verify-otp. El token es de un solo uso.',
  })
  @ApiNoContentResponse({
    description: 'Contraseña actualizada exitosamente.',
  })
  @ApiBadRequestResponse({
    description: 'Token inválido, expirado o nueva contraseña débil.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al cambiar la contraseña.',
    type: ErrorResponseDto,
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(
      dto.email,
      dto.reset_token,
      dto.new_password,
    );
  }

  @Post('introspect')
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar vigencia del access_token de sesión' })
  @ApiIntrospectGuardResponse()
  async introspect(@BearerToken() token: string) {
    return this.authService.introspect(token);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contraseña cambiada exitosamente.',
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al cambiar la contraseña.',
    type: ErrorResponseDto,
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: IntrospectResponse,
  ) {
    await this.authService.changePassword(String(currentUser.userId), dto);
    return { message: this.i18n.t('auth.PASSWORD_CHANGED') };
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiIntrospectGuardResponse()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar sesiones activas del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sesiones activas.',
    type: [SessionResponseDto],
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al obtener sesiones.',
    type: ErrorResponseDto,
  })
  async getActiveSessions(@CurrentUser() currentUser: IntrospectResponse) {
    return this.authService.getActiveSessions(String(currentUser.userId));
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AuthGuard)
  @ApiIntrospectGuardResponse()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar una sesión específica' })
  @ApiNoContentResponse({
    description: 'Sesión revocada exitosamente.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al revocar la sesión.',
    type: ErrorResponseDto,
  })
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: IntrospectResponse,
  ) {
    await this.authService.revokeSession(String(currentUser.userId), sessionId);
  }

  @Get('access-history')
  @UseGuards(AuthGuard)
  @ApiIntrospectGuardResponse()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener historial de accesos del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Historial de accesos.',
    type: [EventResponseDto],
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al obtener historial de accesos.',
    type: ErrorResponseDto,
  })
  async getAccessHistory(@CurrentUser() currentUser: IntrospectResponse) {
    return this.authService.getAccessHistory(String(currentUser.userId));
  }

  @Post('encrypt')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Encriptar una contraseña con AES-256-GCM',
    description:
      'Encripta una contraseña en texto plano usando la clave ENC_IDENTITY_KEY del servidor. ' +
      'El resultado se puede enviar directamente en el campo password de POST /auth/login. ' +
      'Solo disponible en entornos de desarrollo (APP_DEV=true o NODE_ENV != PROD).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contraseña encriptada exitosamente.',
    type: EncryptPasswordResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Error al encriptar la contraseña.',
    type: ErrorResponseDto,
  })
  encryptPassword(@Body() dto: EncryptPasswordDto) {
    const encryptEnabled = this.configService.get<string>('AUTH_ENCRYPT_ENABLED', 'true');
    if (encryptEnabled !== 'true') {
      throw new ForbiddenException(this.i18n.t('auth.ENCRYPT_DISABLED'));
    }
    const encrypted = this.authService.encryptPassword(dto.password);
    return { encrypted_password: encrypted };
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0].trim();
      return ip;
    }
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }
}
