/**
 * User Wallets raw API layer.
 *
 * Thin wrappers around Axios. No caching, no UI state.
 * apiClient already unwraps the ApiResponse envelope.
 */

import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type { UserWalletListResponse } from './user-wallets.model';

/** GET /api/manage/v1/wallets/user/list — user wallets (no params, frontend pagination). */
export function getUserWallets(
  config?: ApiRequestConfig,
): Promise<UserWalletListResponse> {
  return apiClient.get('/api/manage/v1/wallets/user/list', config);
}
