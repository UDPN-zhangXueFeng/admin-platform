import { apiClient } from '@myorg/shared/data-access-api';import type { CoinData, TrendDataPoint, StatisticsData } from './statistic-analysis.model';
export const fetchCoinList = () => apiClient.get<CoinData[]>('/api/manage/v1/common/resources/search');
export const fetchStatistics = (stablecoinCode: string) => apiClient.post<StatisticsData>('/api/manage/v1/statisticsReports/tokenizedDepositsList', { stablecoinCode });
export const fetchTrendData = (params: { stablecoinCode: string; startTime: string; endTime: string }) => apiClient.post<TrendDataPoint[]>('/api/manage/v1/common/stablecoin/searches', params);
export const fetchTrendTzData = (params: { stablecoinCode: string; startTime: string; endTime: string }) => apiClient.post<TrendDataPoint[]>('/api/manage/v1/common/stablecoin/searches', params);
