import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { SupportRequestService } from '@support/service/support-request.service';
import { CreateSupportRequestDto } from '@support/dto/support-request/create-support-request.dto';
import { SupportRequestResponseDto } from '@support/dto/support-request/support-request-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('support')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/support-requests')
export class SupportRequestController {
  constructor(private readonly supportRequestService: SupportRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una solicitud de soporte' })
  @ApiCreatedResponse({
    description: 'Solicitud creada.',
    type: SupportRequestResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la solicitud.',
    type: ErrorResponseDto,
  })
  async create(
    @CurrentUser() user: IntrospectResponse,
    @Body() dto: CreateSupportRequestDto,
  ) {
    return this.supportRequestService.create(user.userId!, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar mis solicitudes de soporte' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de solicitudes del usuario.',
    type: [SupportRequestResponseDto],
  })
  async findAll(@CurrentUser() user: IntrospectResponse) {
    return this.supportRequestService.findAll(user.userId!);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener una de mis solicitudes de soporte' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solicitud encontrada.',
    type: SupportRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Solicitud no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @CurrentUser() user: IntrospectResponse,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.supportRequestService.findOne(id, user.userId!);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una de mis solicitudes de soporte' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Solicitud eliminada.',
  })
  @ApiNotFoundResponse({
    description: 'Solicitud no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(
    @CurrentUser() user: IntrospectResponse,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.supportRequestService.remove(id, user.userId!);
  }
}
