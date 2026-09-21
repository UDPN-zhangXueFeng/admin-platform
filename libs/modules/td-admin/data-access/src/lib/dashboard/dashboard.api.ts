import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type {
  StableCoinOverview,
  StablecoinOption,
  DashboardTrendRequest,
  WalletStatisticsResponse,
  TransactionStatisticsResponse,
} from './dashboard.model';

export function getStablecoinOptions(
  config?: ApiRequestConfig,
): Promise<StablecoinOption[]> {
  return apiClient.get(
    '/api/manage/v1/common/stablecoin/enabled/searches',
    config,
  );
}

export function getStableCoinOverview(
  stablecoinCode: string,
  config?: ApiRequestConfig,
): Promise<StableCoinOverview> {
  return apiClient.post(
    '/api/manage/v1/td/dashboard/stablecoin/statistics',
    { stablecoinCode },
    config,
  );
}

export function getWalletStatistics(
  params: DashboardTrendRequest,
  config?: ApiRequestConfig,
): Promise<WalletStatisticsResponse> {
  return apiClient.post(
    '/api/manage/v1/td/dashboard/wallet/statistics',
    params,
    config,
  );
}

export function getTransactionStatistics(
  params: DashboardTrendRequest,
  config?: ApiRequestConfig,
): Promise<TransactionStatisticsResponse> {
  return apiClient.post(
    '/api/manage/v1/td/dashboard/transaction/statistics',
    params,
    config,
  );
}
