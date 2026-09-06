import {
  Controller,
  Get,
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
  ApiNotFoundResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { IntelligenceService } from '@intelligence/service/intelligence.service';
import { FinancialSummaryResponseDto } from '@intelligence/dto/financial-summary-response.dto';
import { TaxSummaryResponseDto } from '@intelligence/dto/tax-summary-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('intelligence')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/intelligence')
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  @Get('financial-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener el resumen financiero más reciente del usuario',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen financiero.',
    type: FinancialSummaryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Resumen no encontrado.',
    type: ErrorResponseDto,
  })
  async getFinancialSummary(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.intelligenceService.findFinancialSummary(userId);
  }

  @Get('financial-summary/period/:periodId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener resumen financiero por período específico',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen del período.',
    type: FinancialSummaryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Resumen no encontrado.',
    type: ErrorResponseDto,
  })
  async getFinancialSummaryByPeriod(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('periodId', ParseIntPipe) periodId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
  ) {
    return this.intelligenceService.findFinancialSummaryByPeriod(
      userId,
      periodId,
    );
  }

  @Get('tax-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener resumen fiscal del usuario' })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Año fiscal (default: año actual)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen fiscal.',
    type: TaxSummaryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Resumen fiscal no encontrado.',
    type: ErrorResponseDto,
  })
  async getTaxSummary(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
    @Query('year') year?: string,
  ) {
    const fiscalYear = year ? parseInt(year, 10) : undefined;
    return this.intelligenceService.findTaxSummary(userId, fiscalYear);
  }
}
