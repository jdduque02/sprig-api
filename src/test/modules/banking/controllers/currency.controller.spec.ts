import { InternalServerErrorException } from '@nestjs/common';
import { CurrencyController } from '@banking/controller/currency.controller';
import { MarketDataService } from '@banking/service/market-data.service';

const mockMarketData = { fetchFxRate: jest.fn() };
const mockI18n = { t: jest.fn((key: string) => key) };

describe('CurrencyController', () => {
  let controller: CurrencyController;

  beforeEach(() => {
    controller = new CurrencyController(
      mockMarketData as unknown as MarketDataService,
      mockI18n as never,
    );
    jest.clearAllMocks();
  });

  it('retorna la tasa de cambio', async () => {
    const rates = { usd_cop: 4100 };
    mockMarketData.fetchFxRate.mockResolvedValue(rates);
    await expect(controller.rates()).resolves.toEqual(rates);
  });

  it('lanza InternalServerError si falla la consulta', async () => {
    mockMarketData.fetchFxRate.mockRejectedValue(new Error('network'));
    await expect(controller.rates()).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('traduce el mensaje de error usando la clave banking.FX_RATE_UNAVAILABLE', async () => {
    mockMarketData.fetchFxRate.mockRejectedValue(new Error('network'));
    await expect(controller.rates()).rejects.toThrow();
    expect(mockI18n.t).toHaveBeenCalledWith('banking.FX_RATE_UNAVAILABLE');
  });
});
