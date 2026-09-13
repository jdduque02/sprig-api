import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { ObjectivePaymentService } from '@finance/service/objective-payment.service';
import { CreateObjectivePaymentDto } from '@finance/dto/objective-payment/create-objective-payment.dto';
import { ObjectivePaymentResponseDto } from '@finance/dto/objective-payment/objective-payment-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/financial-objectives/:objectiveId/payments')
export class ObjectivePaymentController {
  constructor(
    private readonly objectivePaymentService: ObjectivePaymentService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar abono a un objetivo financiero' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Abono registrado.',
    type: ObjectivePaymentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al registrar el abono.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('objectiveId', ParseIntPipe) objectiveId: number,
    @Body() dto: CreateObjectivePaymentDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.objectivePaymentService.create(userId, {
      ...dto,
      objective_id: objectiveId,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar abonos de un objetivo financiero' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Abonos del objetivo.',
    type: [ObjectivePaymentResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('objectiveId', ParseIntPipe) objectiveId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.objectivePaymentService.findByObjective(objectiveId, userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener abono por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Abono encontrado.',
    type: ObjectivePaymentResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Abono no encontrado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.objectivePaymentService.findOne(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar abono' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Abono eliminado.',
  })
  @ApiNotFoundResponse({
    description: 'Abono no encontrado.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.objectivePaymentService.remove(id, userId);
  }
}
