import { apiClient } from '@myorg/shared/data-access-api';

import type {
  CoinData,
  StatisticsData,
  TrendDataPoint,
} from './statistic-analysis.model';

/**
 * Endpoints mirror the old td-manage statistic-analysis/dashboard APIs:
 * - coin list: GET  /common/stablecoin/enabled/searches
 * - overview : POST /td/dashboard/stablecoin/statistics
 * - wallet   : POST /td/dashboard/wallet/statistics
 * - tx       : POST /td/dashboard/transaction/statistics
 */
const COIN_LIST_URL = '/api/manage/v1/common/stablecoin/enabled/searches';
const OVERVIEW_URL = '/api/manage/v1/td/dashboard/stablecoin/statistics';
const WALLET_STATS_URL = '/api/manage/v1/td/dashboard/wallet/statistics';
const TX_STATS_URL = '/api/manage/v1/td/dashboard/transaction/statistics';

export const fetchCoinList = async (): Promise<CoinData[]> => {
  const rows = await apiClient.get<Array<CoinData & { issueType?: number }>>(
    COIN_LIST_URL,
  );
  // Old page maps `issueType` -> `tokenType` before rendering icons/labels.
  return (rows ?? []).map((row) => ({
    ...row,
    label: row.symbol,
    value: row.code,
    tokenType: row.issueType ?? row.tokenType,
  }));
};

export const fetchStatistics = (stablecoinCode: string) =>
  apiClient.post<StatisticsData>(OVERVIEW_URL, { stablecoinCode });

export const fetchTrendData = (params: {
  stablecoinCode: string;
  startTime: string;
  endTime: string;
}) => apiClient.post<TrendDataPoint[]>(WALLET_STATS_URL, params);

export const fetchTrendTzData = (params: {
  stablecoinCode: string;
  startTime: string;
  endTime: string;
}) => apiClient.post<TrendDataPoint[]>(TX_STATS_URL, params);
