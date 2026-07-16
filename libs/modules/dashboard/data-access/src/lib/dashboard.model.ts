import type { PaginationParams } from '@myorg/shared/model';

export type TimeRangeKey = '7d' | '14d' | '30d';

export interface StablecoinOption {
  code: string;
  symbol: string;
  name?: string;
  stablecoinId?: number;
  blockchainNameAbbreviation?: string;
  tokenType?: string;
  issueType?: string;
}

export interface StableCoinOverview {
  surplusCount: number;
  circulationTotal: number;
  issueTotal: number;
  destructionTotal: number;
  numOfWallets: number;
}

export interface WalletStatisticsRequest extends PaginationParams {
  statisticsType: 1;
  statisticsDateType: number;
  startDate?: string;
  endDate?: string;
}

export interface WalletStatisticsResponse {
  dateList: string[];
  statisticsCount: {
    walletNum: number[];
    newWalletNum: number[];
  };
}

export interface TransactionStatisticsRequest extends PaginationParams {
  statisticsType: 2;
  statisticsDateType: number;
  startDate?: string;
  endDate?: string;
}

export interface TransactionStatisticsResponse {
  dateList: string[];
  statisticsCount: {
    purchaseTotal: number[];
    transferTotal: number[];
    withdrawalTotal: number[];
  };
}
