import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiForbiddenResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { BankAccountService } from '@banking/service/bank-account.service';
import { InterestAccrualScheduler } from '@banking/service/interest-accrual.scheduler';
import { CreateBankAccountDto } from '@banking/dto/bank-account/create-bank-account.dto';
import { UpdateBankAccountDto } from '@banking/dto/bank-account/update-bank-account.dto';
import { BankAccountResponseDto } from '@banking/dto/bank-account/bank-account-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('banking')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/bank-accounts')
export class BankAccountController {
  constructor(
    private readonly bankAccountService: BankAccountService,
    private readonly interestAccrualScheduler: InterestAccrualScheduler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nueva cuenta bancaria' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cuenta creada exitosamente.',
    type: BankAccountResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la cuenta.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateBankAccountDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.bankAccountService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar cuentas bancarias del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cuentas del usuario.',
    type: [BankAccountResponseDto],
  })
  async findAll(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.bankAccountService.findAll(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener cuenta bancaria por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cuenta encontrada.',
    type: BankAccountResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Cuenta no encontrada.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.bankAccountService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar cuenta bancaria' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cuenta actualizada.',
    type: BankAccountResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Cuenta no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBankAccountDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.bankAccountService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar cuenta bancaria (soft delete)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Cuenta eliminada.',
  })
  @ApiNotFoundResponse({
    description: 'Cuenta no encontrada.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.bankAccountService.remove(id, userId);
  }

  @Get(':id/projected-yield')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calcular proyección de rendimiento de una cuenta' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proyección de rendimiento.',
  })
  @ApiNotFoundResponse({
    description: 'Cuenta no encontrada.',
    type: ErrorResponseDto,
  })
  async getProjectedYield(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.bankAccountService.getProjectedYield(id, userId);
  }

  @Post('accrue-interest')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Ejecutar capitalización de intereses manual (backfill/dev, solo admin)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resultado de la ejecución.',
  })
  @ApiForbiddenResponse({
    description: 'Requiere rol admin.',
    type: ErrorResponseDto,
  })
  async accrueInterest(
    @Param('userId', ParseIntPipe) _userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.interestAccrualScheduler.triggerManual();
  }
}
