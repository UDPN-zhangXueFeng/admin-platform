/**
 * statistics-reports domain model.
 *
 * Aligned with td-manage upstream (`src/pages/statistics-reports` +
 * `src/lib/api/statistics-reports.ts`):
 * - Wire-level numeric ids (tokenTypeId / stablecoinId) are normalized to
 *   strings at the api boundary (upstream uses them as Tabs keys / row keys).
 * - Status-like fields stay numeric (upstream compares `=== 1`).
 * - Null array payloads are normalized to empty arrays by the api functions.
 */

/** GET /api/manage/v1/common/tokenType/list row (upstream Tabs source). */
export interface TokenType {
  tokenTypeId: string;
  tokenTypeName: string;
  /** Upstream keeps only tabs with `status === 1`. */
  status: number;
}

/** POST /api/manage/v1/common/stablecoin/searches row. */
export interface StablecoinCoin {
  stablecoinId: string;
  name: string;
  symbol: string;
  blockchainNameAbbreviation: string;
}

/** Coin select option shaped like upstream `coinOptions` (`value` = stablecoinId). */
export interface CoinOption {
  value: string;
  label: string;
  symbol: string;
}

/** Overview proportion slice (chart value = count, name = tokenName). */
export interface OverviewProportion {
  count: number;
  tokenName: string;
}

/** POST /api/manage/v1/statisticsReports/stablecoinsOverview payload. */
export interface OverviewResponse {
  stablecoinsCount: number;
  serviceProvidersCount: number;
  walletsCount: number;
  transactionCount: number;
  serviceProvidersProportion: OverviewProportion[];
  walletsProportion: OverviewProportion[];
  transactionCountProportion: OverviewProportion[];
}

/** Overview card point (upstream StablecoinsOverview `ChartData`). */
export interface ChartDataItem {
  title: string;
  count: number;
  chartData: { value: number; name: string }[];
  showChart?: boolean;
}

/** Single-series line point (upstream StatisticsChart `DataPoint`). */
export interface DataPoint {
  date: string;
  value: number;
}

/** Dual-series point (upstream StatisticsChart `DoubleDataPoint`). */
export interface DoubleDataPoint {
  date: string;
  count: number;
  volume: number;
}

/** Multi-series point keyed by series name (upstream StatisticsChart `MultiLineDataPoint`). */
export interface MultiLineDataPoint {
  date: string;
  [key: string]: number | string;
}

/** Per-coin chart bundle (data props of upstream StatisticsChart). */
export interface StablecoinChartData {
  coinName: string;
  coinId: string;
  walletData: DataPoint[];
  spTransactionData: DoubleDataPoint[];
  abcCountData: MultiLineDataPoint[];
  abcVolumeData: MultiLineDataPoint[];
}

/** Params shared by the four per-coin series endpoints. */
export interface ChartSeriesParams {
  tokenId: string;
  startTime: number;
  endTime: number;
}

/** POST /api/manage/v1/statisticsReports/walletQuantityStatistics row. */
export interface WalletQuantityItem {
  /** Millisecond timestamp; upstream getDateFormat tolerates string|number. */
  time: number | string;
  numberOfNewWallets: number;
}

/** POST /api/manage/v1/statisticsReports/spTransactionStatistics row. */
export interface SpTransactionItem {
  spName: string;
  transactionCount: number;
  /** Live backend returns numeric-string amounts. */
  transactionVolume: number | string;
}

/** POST /api/manage/v1/statisticsReports/abcTransactionCountStatistics row. */
export interface AbcTransactionCountItem {
  time: number | string;
  topUpCount: number;
  transferCount: number;
  withdrawalCount: number;
}

/**
 * POST /api/manage/v1/statisticsReports/abcTransactionVolumeStatistics row.
 * Upstream export prefers the *Volume fields with *Count fallback
 * (`item.topUpVolume ?? item.topUpCount`). Live backend currently omits
 * *Volume and carries numeric-string amounts under the legacy *Count names.
 */
export interface AbcTransactionVolumeItem {
  time: number | string;
  /** Absent on the live backend today; normalized to null when missing. */
  topUpVolume: number | string | null;
  transferVolume: number | string | null;
  withdrawalVolume: number | string | null;
  /** Legacy carrier of volume amounts (numeric strings) on this endpoint. */
  topUpCount: number | string;
  transferCount: number | string;
  withdrawalCount: number | string;
}

/** tokenizedDepositsList / td/list row (also the export table row). */
export interface TokenListItem {
  stablecoinId: string;
  todoId: number;
  tokenName: string;
  tokenSymbol: string;
  currencySymbol: string;
  blockchain: string;
  reserveAccount: number | string;
  repositoryBalance: number | string;
  stablecoinsInCirculation: number | string;
  totalMinted: number | string;
  totalMelted: number | string;
  serviceProviders: number;
  wallets: number;
  /** Upstream renders `tokenStatus === 1` as active. */
  tokenStatus: number;
}

/** Params for POST /api/manage/v1/statisticsReports/tokenizedDepositsList. */
export interface TokenizedDepositsListParams {
  tokenType: string;
  pageNum: number;
  pageSize: number;
}

/** Server-paginated envelope (upstream CustomTable `{ data, page }` convention). */
export interface TokenizedDepositsPage {
  page: { total: number };
  rows: TokenListItem[];
}
