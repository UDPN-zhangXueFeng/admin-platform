/**
 * Key-Signed Transactions raw API layer.
 *
 * Thin wrappers around Axios. No caching, no UI state.
 * apiClient already unwraps the ApiResponse envelope.
 */

import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type {
  KeySignedTransactionDetail,
  KeySignedTransactionListParams,
  KeySignedTransactionListResponse,
  KeyServiceConfiguration,
  KeyServiceConfigurationListParams,
  KeyServiceConfigurationListResponse,
  KeyServicePlatform,
  StablecoinOption,
  BlockchainOption,
} from './key-signed-transactions.model';

/** POST /signed/transaction/signedTransactions — paginated list. */
export function getKeySignedTransactions(
  params: KeySignedTransactionListParams,
  config?: ApiRequestConfig,
): Promise<KeySignedTransactionListResponse> {
  return apiClient.post(
    '/manage/v1/signed/transaction/signedTransactions',
    params,
    config,
  );
}

/** GET /signed/transaction/signedTransactionDetail — single detail. */
export function getKeySignedTransactionDetail(
  txRecordId: number,
  config?: ApiRequestConfig,
): Promise<KeySignedTransactionDetail> {
  return apiClient.get(
    '/manage/v1/signed/transaction/signedTransactionDetail',
    { ...config, params: { txRecordId } },
  );
}

/** GET /signed/transaction/keyServices — key service platforms. */
export function getKeyServicePlatforms(
  config?: ApiRequestConfig,
): Promise<KeyServicePlatform[]> {
  return apiClient.get('/manage/v1/signed/transaction/keyServices', config);
}

/** GET /common/stablecoin/enabled/searches — enabled stablecoins. */
export function getStablecoinOptions(
  config?: ApiRequestConfig,
): Promise<StablecoinOption[]> {
  return apiClient.get('/manage/v1/common/stablecoin/enabled/searches', config);
}

/** GET /common/blockchain/list — blockchain list. */
export function getBlockchainOptions(
  config?: ApiRequestConfig,
): Promise<BlockchainOption[]> {
  return apiClient.get('/manage/v1/common/blockchain/list', config);
}

/** Query key service configurations with server-side pagination. */
export async function getKeyServiceConfigurations(
  params: KeyServiceConfigurationListParams,
  config?: ApiRequestConfig,
): Promise<KeyServiceConfigurationListResponse> {
  const response = await apiClient.post<{
    page?: KeyServiceConfigurationListResponse['page'];
    rows?: Omit<KeyServiceConfiguration, 'id'>[];
  }>(
    '/api/manage/v1/key/config/keyServiceList',
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row) => ({
      ...row,
      id: row.keyServiceCode ?? '',
    })),
  };
}
