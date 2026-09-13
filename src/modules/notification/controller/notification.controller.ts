import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { NotificationService } from '../service/notification.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('notification')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear notificación' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notificación creada.',
    type: NotificationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la notificación.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateNotificationDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.notificationService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  @ApiQuery({
    name: 'is_read',
    required: false,
    description: 'Filtrar por estado de lectura',
  })
  @ApiQuery({
    name: 'is_active',
    required: false,
    description: 'Filtrar por estado activo',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notificaciones del usuario.',
    type: [NotificationResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: NotificationQueryDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.notificationService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener notificación por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notificación encontrada.',
    type: NotificationResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Notificación no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.notificationService.findOne(id, userId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Todas las notificaciones marcadas como leídas.',
  })
  async markAllAsRead(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar notificación' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notificación actualizada.',
    type: NotificationResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Notificación no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotificationDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.notificationService.update(id, userId, dto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notificación marcada como leída.',
    type: NotificationResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Notificación no encontrada.',
    type: ErrorResponseDto,
  })
  async markAsRead(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.notificationService.markAsRead(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar notificación' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Notificación eliminada.',
  })
  @ApiNotFoundResponse({
    description: 'Notificación no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.notificationService.remove(id, userId);
  }
}
