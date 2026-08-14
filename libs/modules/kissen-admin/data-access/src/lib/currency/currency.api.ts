import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  CurrencyListFilter,
  CurrencyRow,
  CurrencySaveReq,
  CurrencyToggleReq,
} from './currency.model';

/** 币种分页列表（POST /manage/currency/list）。 */
export function getCurrencyList(
  req: { pageNum: number; pageSize: number; filter: CurrencyListFilter },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<CurrencyRow>> {
  return kissenPage<CurrencyRow, CurrencyListFilter>(
    '/manage/currency/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 已启用（status=20）币种全量：银行多选与货币对下拉数据源。 */
export function getCurrencyEnabledList(
  config?: AxiosRequestConfig,
): Promise<CurrencyRow[]> {
  return kissenRequest.get<CurrencyRow[]>('/manage/currency/list-enabled', config);
}

export function saveCurrency(req: CurrencySaveReq): Promise<{ currencyId: number }> {
  return kissenRequest.post('/manage/currency/save', req);
}

export function toggleCurrencyStatus(req: CurrencyToggleReq): Promise<void> {
  return kissenRequest.post('/manage/currency/toggle-status', req);
}
