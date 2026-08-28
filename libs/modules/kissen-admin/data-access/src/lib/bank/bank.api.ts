/**
 * Bank domain raw API layer (source `api/bank.ts`).
 *
 * List rides the shared `{page, data}` envelope via kissenPage; detail/save/
 * enable/disable are plain JSON endpoints. Approval, limit and supported-
 * currency endpoints of v1.x are gone with the v2.0 flow.
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { BankListFilter, BankListReq, BankRow, BankSaveReq } from './bank.model';

/** Bank paged list (POST /manage/bank/list). */
export function getBankList(
  req: BankListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<BankRow>> {
  return kissenPage<BankRow, BankListFilter>(
    '/manage/bank/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** Bank detail (GET /manage/bank/detail/{bankId}). */
export function getBankDetail(
  bankId: number,
  config?: AxiosRequestConfig,
): Promise<BankRow> {
  return kissenRequest.get(`/manage/bank/detail/${bankId}`, config);
}

/** Create/edit bank (POST /manage/bank/save). Returns the bank id. */
export function saveBank(
  req: BankSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ bankId: number }> {
  return kissenRequest.post('/manage/bank/save', req, config);
}

/** Disable an onboarded/registering bank (POST /manage/bank/{bankId}/disable). */
export function bankDisable(
  bankId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/manage/bank/${bankId}/disable`, undefined, config);
}

/** Re-enable a disabled bank (POST /manage/bank/{bankId}/enable). */
export function bankEnable(
  bankId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/manage/bank/${bankId}/enable`, undefined, config);
}
