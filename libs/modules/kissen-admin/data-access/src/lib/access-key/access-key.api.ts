/**
 * Access-key domain raw API layer (source `api/access-key.ts`).
 *
 * The list endpoint returns a bare row array (not paged); generation returns
 * the one-time plaintext envelope.
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-client';
import type { AccessKeyGenerated, AccessKeyListFilter, AccessKeyRevokeReq, AccessKeyRow } from './access-key.model';

/** Generate an access key for a bank (POST /manage/bank/{bankId}/access-key). */
export function accessKeyGenerate(
  bankId: number,
  config?: AxiosRequestConfig,
): Promise<AccessKeyGenerated> {
  return kissenRequest.post(`/manage/bank/${bankId}/access-key`, undefined, config);
}

/** Access-key ledger (POST /manage/bank/access-key/list; bare array). */
export function accessKeyList(
  filter: AccessKeyListFilter,
  config?: AxiosRequestConfig,
): Promise<AccessKeyRow[]> {
  return kissenRequest.post<AccessKeyRow[]>('/manage/bank/access-key/list', filter, config);
}

/** Revoke an active key (POST /manage/bank/access-key/revoke; reason 1-200 chars). */
export function accessKeyRevoke(
  req: AccessKeyRevokeReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/bank/access-key/revoke', req, config);
}
