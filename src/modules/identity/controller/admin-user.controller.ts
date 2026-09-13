import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@identity/service/user.service';
import { UserQueryDto } from '@identity/dto/user/user-query.dto';
import { UserResponseDto } from '@identity/dto/user/user-response.dto';
import { UpdateUserRolesDto } from '@identity/dto/user/update-user-roles.dto';
import { UpdateUserStatusDto } from '@identity/dto/user/update-user-status.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

@ApiTags('admin / users')
@ApiExtraModels(UserResponseDto)
@UseGuards(AuthGuard, AdminGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar usuarios (admin) con filtros y última conexión',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, example: 'admin' })
  @ApiQuery({ name: 'is_active', required: false, example: true })
  @ApiQuery({ name: 'sortBy', required: false, example: 'last_login_at' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de usuarios.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(UserResponseDto) },
        },
        total: { type: 'number' },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async findAll(@Query() query: UserQueryDto) {
    return this.userService.findAllUsers(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detalle admin: PII, metadata, sesiones e historial',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle del usuario.' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async findOne(@Param('id') id: string) {
    return this.userService.findAdminUserDetail(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar / desactivar usuario' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: IntrospectResponse,
  ) {
    return this.userService.updateUserStatus(id, dto.is_active, admin.userId!);
  }

  @Patch(':id/roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Asignar roles de realm (reemplazo)' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async updateRoles(
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() admin: IntrospectResponse,
  ) {
    return this.userService.updateUserRoles(id, dto.roles, admin.userId!);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar email de restablecimiento de contraseña' })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() admin: IntrospectResponse,
  ) {
    return this.userService.adminResetPassword(id, admin.userId!);
  }

  @Delete(':id/sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revocar todas las sesiones del usuario' })
  async revokeAllSessions(
    @Param('id') id: string,
    @CurrentUser() admin: IntrospectResponse,
  ) {
    return this.userService.adminRevokeAllSessions(id, admin.userId!);
  }

  @Delete(':id/sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revocar una sesión específica' })
  async revokeSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() admin: IntrospectResponse,
  ) {
    return this.userService.adminRevokeSession(id, sessionId, admin.userId!);
  }
}
