/**
 * Key Service Configuration raw API layer.
 *
 * Thin wrappers around Axios. No caching, no UI state.
 * apiClient already unwraps the ApiResponse envelope.
 */

import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type {
  KeyServiceDetail,
  KeyServiceDetailReq,
  KeyServiceOperationRecordParams,
  KeyServiceOperationRecordResponse,
  KeyServicePlatform,
} from './key-service-configuration.model';

/** POST /api/manage/v1/key/config/detail — single key service detail. */
export function getKeyServiceConfigurationDetail(
  req: KeyServiceDetailReq,
  config?: ApiRequestConfig,
): Promise<KeyServiceDetail> {
  return apiClient.post(
    '/api/manage/v1/key/config/detail',
    { keyServiceCode: req.keyServiceCode },
    config,
  );
}

/** POST /api/manage/v1/key/config/operationRecords — paginated operation records. */
export function getKeyServiceOperationRecords(
  params: KeyServiceOperationRecordParams,
  config?: ApiRequestConfig,
): Promise<KeyServiceOperationRecordResponse> {
  return apiClient.post(
    '/api/manage/v1/key/config/operationRecords',
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
}

/** POST /api/manage/v1/key/config/listKeyService — third-party platforms. */
export function getKeyServiceList(
  config?: ApiRequestConfig,
): Promise<KeyServicePlatform[]> {
  return apiClient.post('/api/manage/v1/key/config/listKeyService', {}, config);
}
