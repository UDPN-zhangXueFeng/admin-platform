/**
 * Managed Wallets raw API layer.
 *
 * Thin wrappers around Axios. No caching, no UI state.
 * apiClient already unwraps the ApiResponse envelope.
 * Stablecoin / blockchain dropdown APIs are reused from key-signed-transactions.api.
 */

import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type {
  ManagedWalletDetail,
  ManagedWalletDetailReq,
  ManagedWalletListParams,
  ManagedWalletListResponse,
  WalletRotationHistoryParams,
  WalletRotationHistoryResponse,
} from './managed-wallets.model';

/** POST /api/manage/v1/wallets/manage/list — paginated list. */
export function getManagedWallets(
  params: ManagedWalletListParams,
  config?: ApiRequestConfig,
): Promise<ManagedWalletListResponse> {
  return apiClient.post(
    '/api/manage/v1/wallets/manage/list',
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
}

/** POST /api/manage/v1/wallets/manage/detail — single wallet detail. */
export function getManagedWalletDetail(
  req: ManagedWalletDetailReq,
  config?: ApiRequestConfig,
): Promise<ManagedWalletDetail> {
  return apiClient.post(
    '/api/manage/v1/wallets/manage/detail',
    { chainAccountId: req.chainAccountId },
    config,
  );
}

/** POST /api/manage/v1/wallets/manage/rotation/history — paginated rotation history. */
export function getManagedWalletRotationHistory(
  params: WalletRotationHistoryParams,
  config?: ApiRequestConfig,
): Promise<WalletRotationHistoryResponse> {
  return apiClient.post(
    '/api/manage/v1/wallets/manage/rotation/history',
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
}
