/**
 * Key Service Configuration read-query hooks.
 *
 * Bridges API calls with cache keys via TanStack Query.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getKeyServiceConfigurationDetail,
  getKeyServiceList,
  getKeyServiceOperationRecords,
} from './key-service-configuration.api';
import type { KeyServiceOperationRecordParams } from './key-service-configuration.model';
import { keyServiceConfigurationKeys } from './key-service-configuration.keys';

/** Single key service detail. */
export function useKeyServiceConfigurationDetailQuery(keyServiceCode?: string) {
  return useQuery({
    queryKey: keyServiceConfigurationKeys.detail(keyServiceCode ?? ''),
    queryFn: ({ signal }) =>
      getKeyServiceConfigurationDetail(
        { keyServiceCode: keyServiceCode! },
        { signal },
      ),
    enabled: Boolean(keyServiceCode),
  });
}

/** Paginated operation records for a key service. */
export function useKeyServiceOperationRecordsQuery(
  params: KeyServiceOperationRecordParams,
) {
  return useQuery({
    queryKey: keyServiceConfigurationKeys.operationRecord(params),
    queryFn: ({ signal }) => getKeyServiceOperationRecords(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** Third-party key service platforms (configure-page dropdown). */
export function useKeyServiceListQuery() {
  return useQuery({
    queryKey: keyServiceConfigurationKeys.list(),
    queryFn: ({ signal }) => getKeyServiceList({ signal }),
  });
}
