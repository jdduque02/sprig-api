import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { MarketDataService } from '@banking/service/market-data.service';

const mockHttpService = {
  get: jest.fn(),
};

const response = <T>(data: T) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} },
});

describe('MarketDataService', () => {
  let service: MarketDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketDataService(mockHttpService as unknown as HttpService);
  });

  describe('fetchQuote', () => {
    it('delega a Yahoo por defecto', async () => {
      mockHttpService.get.mockReturnValue(
        of(
          response({
            chart: {
              result: [
                { meta: { regularMarketPrice: 150.5, currency: 'USD' } },
              ],
            },
          }),
        ),
      );
      const quote = await service.fetchQuote('AAPL');
      expect(quote).toEqual({ symbol: 'AAPL', price: 150.5, currency: 'USD' });
    });

    it('delega a CoinGecko para cripto', async () => {
      mockHttpService.get.mockReturnValue(
        of(response({ bitcoin: { usd: 50000 } })),
      );
      const quote = await service.fetchQuote('BTC', 'coingecko');
      expect(quote).toEqual({ symbol: 'BTC', price: 50000, currency: 'USD' });
    });

    it('lanza error si Yahoo no devuelve precio', async () => {
      mockHttpService.get.mockReturnValue(of(response({ chart: {} })));
      await expect(service.fetchQuote('NOPE')).rejects.toThrow(
        /no se pudo obtener/i,
      );
    });

    it('lanza error si CoinGecko no devuelve precio en USD', async () => {
      mockHttpService.get.mockReturnValue(of(response({ bitcoin: {} })));
      await expect(service.fetchQuote('BTC', 'coingecko')).rejects.toThrow(
        /no se pudo obtener la cotización/i,
      );
    });

    it('lanza error si el símbolo cripto no es soportado', async () => {
      await expect(service.fetchQuote('NOPE', 'coingecko')).rejects.toThrow(
        /no soportado/i,
      );
    });
  });

  describe('fetchFxRate', () => {
    it('retorna tasas COP/USD', async () => {
      mockHttpService.get.mockReturnValue(
        of(response({ rates: { COP: 4000 }, time_last_update_utc: 'ts' })),
      );
      const fx = await service.fetchFxRate();
      expect(fx.cop_per_usd).toBe(4000);
      expect(fx.usd_per_cop).toBe(0.00025);
    });

    it('lanza error si COP no está disponible', async () => {
      mockHttpService.get.mockReturnValue(of(response({ rates: {} })));
      await expect(service.fetchFxRate()).rejects.toThrow(/no se pudo/i);
    });
  });

  describe('refreshQuotes', () => {
    it('procesa todos los activos y reporta éxito/fallo', async () => {
      mockHttpService.get.mockImplementation((url: string) => {
        if (url.includes('coingecko'))
          return of(response({ tether: { usd: 1 } }));
        return of(
          response({
            chart: {
              result: [{ meta: { regularMarketPrice: 10, currency: 'USD' } }],
            },
          }),
        );
      });
      const assets = [
        {
          id: 1,
          name: 'A',
          symbol: 'AAPL',
          currency: 'USD',
          quote_source: null,
        },
        {
          id: 2,
          name: 'B',
          symbol: 'USDT',
          currency: 'USD',
          quote_source: 'coingecko',
        },
        { id: 3, name: 'C', symbol: '', currency: 'COP', quote_source: null },
      ] as never[];
      const results = await service.refreshQuotes(assets);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
    });

    it('marca fallo cuando la API falla', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('network')),
      );
      const assets = [
        {
          id: 1,
          name: 'A',
          symbol: 'AAPL',
          currency: 'USD',
          quote_source: null,
        },
      ] as never[];
      const results = await service.refreshQuotes(assets);
      expect(results[0].success).toBe(false);
    });
  });
});
