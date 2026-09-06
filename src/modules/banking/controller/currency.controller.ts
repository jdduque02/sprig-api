import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';
import {
  MarketDataService,
  FxRates,
} from '@banking/service/market-data.service';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('currency')
@Controller('currency')
export class CurrencyController {
  private readonly logger = new Logger(CurrencyController.name);

  constructor(
    private readonly marketDataService: MarketDataService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  @Get('rates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar la tasa de cambio USD/COP vigente.',
  })
  @ApiOkResponse({
    description: 'Tasa de cambio obtenida.',
    type: Object,
  })
  @ApiInternalServerErrorResponse({
    description: 'No se pudo obtener la tasa de cambio.',
    type: ErrorResponseDto,
  })
  async rates(): Promise<FxRates> {
    try {
      return await this.marketDataService.fetchFxRate();
    } catch (error) {
      this.logger.error(
        `Error obteniendo tasa de cambio: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        this.i18n.t('banking.FX_RATE_UNAVAILABLE'),
      );
    }
  }
}
