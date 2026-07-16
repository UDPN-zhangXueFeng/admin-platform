import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  StableCoinOverview,
  StablecoinOption,
  WalletStatisticsRequest,
  WalletStatisticsResponse,
  TransactionStatisticsRequest,
  TransactionStatisticsResponse,
} from './dashboard.model';

export function getStablecoinOptions(
  config?: ApiRequestConfig
): Promise<StablecoinOption[]> {
  return apiClient.get('/api/manage/v1/common/stablecoin/enabled/searches', config);
}

export function getStableCoinOverview(
  config?: ApiRequestConfig
): Promise<StableCoinOverview> {
  return apiClient.post('/api/manage/v1/statistics/getStableCoin', undefined, config);
}

export function getWalletStatistics(
  params: WalletStatisticsRequest,
  config?: ApiRequestConfig
): Promise<WalletStatisticsResponse> {
  return apiClient.post('/api/manage/v1/td/dashboard/wallet/statistics', params, config);
}

export function getTransactionStatistics(
  params: TransactionStatisticsRequest,
  config?: ApiRequestConfig
): Promise<TransactionStatisticsResponse> {
  return apiClient.post('/api/manage/v1/td/dashboard/transaction/statistics', params, config);
}
