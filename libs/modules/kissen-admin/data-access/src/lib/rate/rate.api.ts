import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  ExchangeRateSaveReq,
  RateListFilter,
  RateListReq,
  RateRecordRow,
  RateSaveReq,
} from './rate.model';

/**
 * 加价率变更记录分页列表（POST /manage/rate/list）。
 * 源 `rateList`：body `{ page:{pageNum,pageSize}, data:{pairId?,status?} }`。
 */
export function getRateList(
  req: RateListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<RateRecordRow>> {
  return kissenPage<RateRecordRow, RateListFilter>(
    '/manage/rate/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 提交加价率变更审批（POST /manage/rate/save）。源 `rateSave`（KRC 审批）。 */
export function saveRate(req: RateSaveReq): Promise<void> {
  return kissenRequest.post('/manage/rate/save', req);
}

/**
 * 基础汇率手工维护（POST /manage/exchange-rate/save）。
 * 源 `exchangeRateSave`（FR-R-01）：写货币对现行生效记录，首版无审批立即生效。
 */
export function saveExchangeRate(req: ExchangeRateSaveReq): Promise<void> {
  return kissenRequest.post('/manage/exchange-rate/save', req);
}
