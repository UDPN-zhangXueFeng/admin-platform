import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type { TravelRuleItem, TravelRuleQueryParams } from './travel-rule.model';

/**
 * RESERVED real API for the travel-rule list.
 *
 * NOT wired yet — `useTravelRulesQuery` returns local mock data (PRD §3/§8:
 * there is no real API at this stage). When the backend is ready, switch the
 * `queryFn` in `travel-rule.queries.ts` to call this function; no page changes
 * are required because the return shape already matches the mock.
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
