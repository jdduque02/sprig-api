import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { GmfService } from '@finance/service/gmf.service';
import { GmfSummaryQueryDto } from '@finance/dto/gmf/gmf-summary-query.dto';
import { GmfSummaryResponseDto } from '@finance/dto/gmf/gmf-summary-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('finance')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('users/:userId/gmf')
export class GmfController {
  constructor(private readonly gmfService: GmfService) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resumen del GMF (4x1000) pagado en un periodo y ahorro estimado si ' +
      'las transacciones se hubieran hecho desde una cuenta exenta.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen de GMF calculado.',
    type: GmfSummaryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros inválidos.',
    type: ErrorResponseDto,
  })
  async getSummary(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: GmfSummaryQueryDto,
    @CurrentUser() _currentUser: IntrospectResponse,
  ): Promise<GmfSummaryResponseDto> {
    return this.gmfService.getSummary(userId, query);
  }
}
