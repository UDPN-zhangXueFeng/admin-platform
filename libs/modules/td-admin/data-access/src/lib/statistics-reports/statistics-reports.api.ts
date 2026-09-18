import { apiClient } from '@myorg/shared/data-access-api';
import type { OverviewResponse, StablecoinCoin, TokenListItem, TokenType } from './statistics-reports.model';

export const fetchTokenTypeList = () => apiClient.get<TokenType[]>('/api/manage/v1/common/tokenType/list');
export const fetchStablecoinsOverview = (tokenType: string) => apiClient.post<OverviewResponse>('/api/manage/v1/statisticsReports/stablecoinsOverview', { tokenType });
export const fetchStablecoinList = (tokenTypeId: string) => apiClient.post<StablecoinCoin[]>('/api/manage/v1/common/stablecoin/searches', { tokenTypeId });
export const fetchTokenizedDepositsList = (params: { tokenType: string; pageNum: number; pageSize: number }) => apiClient.post<{ page: { total: number }; rows: TokenListItem[] }>('/api/manage/v1/statisticsReports/tokenizedDepositsList', { data: { tokenType: params.tokenType }, page: { pageNum: params.pageNum, pageSize: params.pageSize } });
export const fetchWalletQuantity = (params: { tokenId: string; startTime: number; endTime: number }) => apiClient.post<{ time: string; numberOfNewWallets: number }[]>('/api/manage/v1/statisticsReports/walletQuantityStatistics', params);
export const fetchSpTransaction = (params: { tokenId: string; startTime: number; endTime: number }) => apiClient.post<{ spName: string; transactionCount: number; transactionVolume: number }[]>('/api/manage/v1/statisticsReports/spTransactionStatistics', params);
export const fetchAbcTransactionCount = (params: { tokenId: string; startTime: number; endTime: number }) => apiClient.post<{ time: string; topUpCount: number; transferCount: number; withdrawalCount: number }[]>('/api/manage/v1/statisticsReports/abcTransactionCountStatistics', params);
export const fetchAbcTransactionVolume = (params: { tokenId: string; startTime: number; endTime: number }) => apiClient.post<{ time: string; topUpCount: number; transferCount: number; withdrawalCount: number }[]>('/api/manage/v1/statisticsReports/abcTransactionVolumeStatistics', params);
export const fetchTdList = (tokenType: string) => apiClient.post<TokenListItem[]>('/api/manage/v1/statisticsReports/td/list', { tokenType });
