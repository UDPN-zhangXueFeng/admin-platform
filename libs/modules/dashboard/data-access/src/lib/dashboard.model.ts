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
  repositoryBalance?: number;
  circulation?: number;
  totalMint?: number;
  totalMelt?: number;
  walletNumber?: number;
  symbol?: string;
  reserveBalance?: number;
  currencySymbol?: string;
}

/** TD dashboard trend request. The backend requires timestamps in milliseconds. */
export interface DashboardTrendRequest {
  stablecoinCode: string;
  startTime: number;
  endTime: number;
}

export interface WalletStatisticsItem {
  statisticsDay?: number;
  walletNumber?: number;
  walletNewNumber?: number;
}

export interface TransactionStatisticsItem {
  statisticsDay?: number;
  topUpTotal?: number;
  transferTotal?: number;
  withdrawalTotal?: number;
}

export type WalletStatisticsResponse = WalletStatisticsItem[];
export type TransactionStatisticsResponse = TransactionStatisticsItem[];
