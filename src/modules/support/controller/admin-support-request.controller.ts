import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { SupportRequestService } from '@support/service/support-request.service';
import { UpdateSupportRequestDto } from '@support/dto/support-request/update-support-request.dto';
import { SupportRequestResponseDto } from '@support/dto/support-request/support-request-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('support (admin)')
@UseGuards(AuthGuard, AdminGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('admin/support-requests')
export class AdminSupportRequestController {
  constructor(private readonly supportRequestService: SupportRequestService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar todas las solicitudes de soporte' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de solicitudes.',
    type: [SupportRequestResponseDto],
  })
  async findAll() {
    return this.supportRequestService.findAllAdmin();
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar estado y notas de una solicitud' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solicitud actualizada.',
    type: SupportRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Solicitud no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al actualizar la solicitud.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupportRequestDto,
  ) {
    return this.supportRequestService.updateAdmin(id, dto);
  }
}
