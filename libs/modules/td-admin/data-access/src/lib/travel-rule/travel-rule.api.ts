import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type { TravelRuleItem, TravelRuleQueryParams } from './travel-rule.model';

/**
 * Reserved list adapter for a future backend contract.
 *
 * The source list page uses local mock data and does not call a list API. The
 * legacy source does declare a separate detail endpoint at
 * `/api/finance/v1/finance/journal/travel-rule/{tdTxId}`; it is not equivalent
 * to this list shape and is therefore not wired here.
 *
 * @param params - Filtering, sorting, and pagination parameters
 * @param config - Optional Axios request config (signal, headers)
 */
export function getTravelRules(
  params: TravelRuleQueryParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<TravelRuleItem>> {
  return apiClient.get('/travel-rules', { ...config, params });
}
