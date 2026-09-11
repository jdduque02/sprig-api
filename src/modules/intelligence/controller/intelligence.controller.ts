import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { IntelligenceService } from '@intelligence/service/intelligence.service';
import { FinancialAiAnalysisService } from '@intelligence/service/financial-ai-analysis.service';
import { FinancialProfileReportService } from '@intelligence/service/financial-profile-report.service';
import { FinancialSummaryResponseDto } from '@intelligence/dto/financial-summary-response.dto';
import { TaxSummaryResponseDto } from '@intelligence/dto/tax-summary-response.dto';
import { FinancialAiAnalysisResponseDto } from '@intelligence/dto/financial-ai-analysis-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('intelligence')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/intelligence')
export class IntelligenceController {
  constructor(
    private readonly intelligenceService: IntelligenceService,
    private readonly financialAiAnalysisService: FinancialAiAnalysisService,
    private readonly financialProfileReportService: FinancialProfileReportService,
  ) {}

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

  @Get('ai-analysis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar análisis financiero con narrativa (IA basada en reglas)',
  })
  @ApiQuery({
    name: 'periodId',
    required: false,
    type: Number,
    description: 'ID del período financiero (default: período actual)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Análisis financiero generado.',
    type: FinancialAiAnalysisResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Perfil financiero o período no encontrado.',
    type: ErrorResponseDto,
  })
  async getAiAnalysis(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
    @Query('periodId') periodId?: string,
  ) {
    return this.financialAiAnalysisService.analyze(userId, {
      periodId: this.parsePeriodId(periodId),
    });
  }

  @Get('report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Descargar reporte PDF con el resumen del perfil financiero',
  })
  @ApiQuery({
    name: 'periodId',
    required: false,
    type: Number,
    description: 'ID del período financiero (default: período actual)',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reporte PDF generado.',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiNotFoundResponse({
    description: 'Perfil financiero o período no encontrado.',
    type: ErrorResponseDto,
  })
  async getReport(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() _currentUser: IntrospectResponse,
    @Query('periodId') periodId: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const pdfBuffer = await this.financialProfileReportService.generate(
      userId,
      { periodId: this.parsePeriodId(periodId) },
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-financiero-${userId}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  private parsePeriodId(periodId?: string): number | undefined {
    if (periodId === undefined) return undefined;
    const parsed = parseInt(periodId, 10);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        `periodId inválido: "${periodId}" no es un número.`,
      );
    }
    return parsed;
  }
}
