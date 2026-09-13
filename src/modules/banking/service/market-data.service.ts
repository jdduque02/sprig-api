import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';

export type QuoteSource = 'yahoo' | 'coingecko';

export interface LiveQuote {
  symbol: string;
  price: number;
  currency: string;
}

export interface AssetQuoteResult extends LiveQuote {
  asset_id: number;
  name: string;
  success: boolean;
}

export interface FxRates {
  cop_per_usd: number;
  usd_per_cop: number;
  source: string;
  updated_at: string;
}

/** Mapeo de símbolos cripto comunes a IDs de CoinGecko. */
const COINGECKO_IDS: Record<string, string> = {
  USDT: 'tether',
  USDC: 'usd-coin',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  LINK: 'chainlink',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
};

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchQuote(
    symbol: string,
    source: QuoteSource = 'yahoo',
  ): Promise<LiveQuote> {
    if (source === 'coingecko') {
      return this.fetchCoinGecko(symbol);
    }
    return this.fetchYahoo(symbol);
  }

  /** Consulta la tasa de cambio USD/COP desde una API pública. */
  async fetchFxRate(): Promise<FxRates> {
    const url = 'https://open.er-api.com/v6/latest/USD';
    const res = await firstValueFrom(
      this.httpService.get(url, { timeout: 8000 }),
    );
    const body = res.data as {
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    const cop = body.rates?.COP;
    if (typeof cop !== 'number' || cop <= 0) {
      throw new Error('No se pudo obtener la tasa de cambio USD/COP');
    }
    return {
      cop_per_usd: cop,
      usd_per_cop: Number((1 / cop).toFixed(6)),
      source: 'open.er-api.com',
      updated_at: body.time_last_update_utc ?? new Date().toISOString(),
    };
  }

  async refreshQuotes(assets: FinancialAsset[]): Promise<AssetQuoteResult[]> {
    return Promise.all(
      assets.map(async (asset) => {
        const symbol = asset.symbol?.trim();
        if (!symbol) {
          return {
            asset_id: asset.id,
            name: asset.name,
            symbol: asset.symbol ?? '',
            price: 0,
            currency: asset.currency,
            success: false,
          };
        }
        try {
          const quote = await this.fetchQuote(
            symbol,
            (asset.quote_source as QuoteSource) ?? 'yahoo',
          );
          return {
            asset_id: asset.id,
            name: asset.name,
            symbol,
            price: quote.price,
            currency: quote.currency,
            success: true,
          };
        } catch (err) {
          this.logger.warn(
            `Fallo cotización ${symbol}: ${(err as Error).message}`,
          );
          return {
            asset_id: asset.id,
            name: asset.name,
            symbol,
            price: 0,
            currency: asset.currency,
            success: false,
          };
        }
      }),
    );
  }

  private async fetchYahoo(symbol: string): Promise<LiveQuote> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await firstValueFrom(
      this.httpService.get(url, { timeout: 8000 }),
    );
    const body = res.data as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; currency?: string };
        }>;
      };
    };
    const meta = body.chart?.result?.[0]?.meta;
    if (typeof meta?.regularMarketPrice !== 'number') {
      throw new Error(`No se pudo obtener la cotización de ${symbol}`);
    }
    return {
      symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency ?? 'USD',
    };
  }

  private async fetchCoinGecko(symbol: string): Promise<LiveQuote> {
    const id = COINGECKO_IDS[symbol.toUpperCase()];
    if (!id) {
      throw new Error(`Símbolo cripto no soportado: ${symbol}`);
    }
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    const res = await firstValueFrom(
      this.httpService.get(url, { timeout: 8000 }),
    );
    const body = res.data as Record<string, { usd?: number }>;
    const price = body[id]?.usd;
    if (typeof price !== 'number') {
      throw new Error(`No se pudo obtener la cotización de ${symbol}`);
    }
    return { symbol, price, currency: 'USD' };
  }
}
