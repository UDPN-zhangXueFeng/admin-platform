import { apiClient } from '@myorg/shared/data-access-api';
import type {
  AbcTransactionCountItem,
  AbcTransactionVolumeItem,
  ChartSeriesParams,
  OverviewResponse,
  SpTransactionItem,
  StablecoinCoin,
  TokenListItem,
  TokenizedDepositsListParams,
  TokenizedDepositsPage,
  TokenType,
  WalletQuantityItem,
} from './statistics-reports.model';

/**
 * Null/malformed array payloads normalize to `[]` (upstream guards every
 * consumer with `Array.isArray` / `?.map`); query data is therefore never
 * null/undefined here.
 */
const toArray = <T>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];


/** Wire rows may carry numeric ids; normalized to string at this boundary. */
type TokenListWireRow = Omit<TokenListItem, 'stablecoinId' | 'tokenStatus'> & {
  stablecoinId: number | string;
  tokenStatus: number | string;
};

const normalizeTokenRow = (row: TokenListWireRow): TokenListItem => ({
  ...row,
  stablecoinId: String(row.stablecoinId),
  tokenStatus: Number(row.tokenStatus),
});

/**
 * GET /api/manage/v1/common/tokenType/list (upstream getTokenTypeApi).
 * tokenTypeId normalized to string; status stays numeric.
 */
export const fetchTokenTypeList = async (): Promise<TokenType[]> => {
  const rows = await apiClient.get<
    {
      tokenTypeId: number | string;
      tokenTypeName: string;
      status: number | string;
    }[]
  >('/api/manage/v1/common/tokenType/list');
  return toArray(rows).map((row) => ({
    tokenTypeId: String(row.tokenTypeId),
    tokenTypeName: row.tokenTypeName,
    status: Number(row.status),
  }));
};

/**
 * POST /api/manage/v1/statisticsReports/stablecoinsOverview.
 * No overview stays null; absence is not a measured zero.
 */
export const fetchStablecoinsOverview = async (
  tokenType: string
): Promise<OverviewResponse | null> => {
  const data = await apiClient.post<OverviewResponse | null>(
    '/api/manage/v1/statisticsReports/stablecoinsOverview',
    { tokenType }
  );
  if (data == null) return null;
  return {
    ...data,
    serviceProvidersProportion: toArray(data.serviceProvidersProportion),
    walletsProportion: toArray(data.walletsProportion),
    transactionCountProportion: toArray(data.transactionCountProportion),
  };
};

/**
 * POST /api/manage/v1/common/stablecoin/searches — explicit upstream POST,
 * kept over the generic dropdown-GET convention.
 */
export const fetchStablecoinList = async (
  tokenTypeId: string
): Promise<StablecoinCoin[]> => {
  const rows = await apiClient.post<
    | {
        stablecoinId: number | string;
        name: string;
        symbol: string;
        blockchainNameAbbreviation: string;
      }[]
    | null
  >('/api/manage/v1/common/stablecoin/searches', { tokenTypeId });
  return toArray(rows).map((row) => ({
    stablecoinId: String(row.stablecoinId),
    name: row.name,
    symbol: row.symbol,
    blockchainNameAbbreviation: row.blockchainNameAbbreviation,
  }));
};

/**
 * POST /api/manage/v1/statisticsReports/tokenizedDepositsList — upstream
 * CustomTable server-pagination envelope `{ data, page }`.
 */
export const fetchTokenizedDepositsList = async (
  params: TokenizedDepositsListParams
): Promise<TokenizedDepositsPage> => {
  const result = await apiClient.post<{
    page: { total: number } | null;
    rows: TokenListWireRow[] | null;
  } | null>('/api/manage/v1/statisticsReports/tokenizedDepositsList', {
    data: { tokenType: params.tokenType },
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
  });
  return {
    page: { total: Number(result?.page?.total ?? 0) },
    rows: toArray(result?.rows).map(normalizeTokenRow),
  };
};

/** POST /api/manage/v1/statisticsReports/walletQuantityStatistics. */
export const fetchWalletQuantity = async (
  params: ChartSeriesParams
): Promise<WalletQuantityItem[]> =>
  toArray(
    await apiClient.post<WalletQuantityItem[] | null>(
      '/api/manage/v1/statisticsReports/walletQuantityStatistics',
      params
    )
  );

/** POST /api/manage/v1/statisticsReports/spTransactionStatistics. */
export const fetchSpTransaction = async (
  params: ChartSeriesParams
): Promise<SpTransactionItem[]> =>
  toArray(
    await apiClient.post<SpTransactionItem[] | null>(
      '/api/manage/v1/statisticsReports/spTransactionStatistics',
      params
    )
  );

/** POST /api/manage/v1/statisticsReports/abcTransactionCountStatistics. */
export const fetchAbcTransactionCount = async (
  params: ChartSeriesParams
): Promise<AbcTransactionCountItem[]> =>
  toArray(
    await apiClient.post<AbcTransactionCountItem[] | null>(
      '/api/manage/v1/statisticsReports/abcTransactionCountStatistics',
      params
    )
  );

/**
 * POST /api/manage/v1/statisticsReports/abcTransactionVolumeStatistics.
 * Rows may omit *Volume (export falls back to *Count); absent volumes
 * normalize to null.
 */
export const fetchAbcTransactionVolume = async (
  params: ChartSeriesParams
): Promise<AbcTransactionVolumeItem[]> => {
  const rows = await apiClient.post<
    | {
        time: number | string;
        topUpVolume?: number | string | null;
        transferVolume?: number | string | null;
        withdrawalVolume?: number | string | null;
        topUpCount: number | string;
        transferCount: number | string;
        withdrawalCount: number | string;
      }[]
    | null
  >(
    '/api/manage/v1/statisticsReports/abcTransactionVolumeStatistics',
    params
  );
  return toArray(rows).map((row) => ({
    time: row.time,
    topUpVolume: row.topUpVolume ?? null,
    transferVolume: row.transferVolume ?? null,
    withdrawalVolume: row.withdrawalVolume ?? null,
    topUpCount: row.topUpCount,
    transferCount: row.transferCount,
    withdrawalCount: row.withdrawalCount,
  }));
};

/** POST /api/manage/v1/statisticsReports/td/list — export-table rows (unpaginated). */
export const fetchTdList = async (
  tokenType: string
): Promise<TokenListItem[]> => {
  const rows = await apiClient.post<TokenListWireRow[] | null>(
    '/api/manage/v1/statisticsReports/td/list',
    { tokenType }
  );
  return toArray(rows).map(normalizeTokenRow);
};
