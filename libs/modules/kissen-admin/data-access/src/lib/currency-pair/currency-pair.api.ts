import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  CurrencyPairIdReq,
  CurrencyPairListFilter,
  CurrencyPairListReq,
  CurrencyPairRow,
  CurrencyPairSaveReq,
} from './currency-pair.model';

/**
 * 货币对分页列表（POST /manage/currency-pair/list）。
 * 源 `currencyPairList`：body `{ page:{pageNum,pageSize}, data:{sourceCurrency?,targetCurrency?,status?} }`。
 */
export function getCurrencyPairList(
  req: CurrencyPairListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<CurrencyPairRow>> {
  return kissenPage<CurrencyPairRow, CurrencyPairListFilter>(
    '/manage/currency-pair/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 新建/编辑货币对（POST /manage/currency-pair/save）。源 `currencyPairSave`。 */
export function saveCurrencyPair(
  req: CurrencyPairSaveReq,
): Promise<{ pairId: number }> {
  return kissenRequest.post('/manage/currency-pair/save', req);
}

/** 提交启用审批（POST /manage/currency-pair/enable）。源 `currencyPairEnable`。 */
export function enableCurrencyPair(req: CurrencyPairIdReq): Promise<void> {
  return kissenRequest.post('/manage/currency-pair/enable', req);
}

/** 提交停用审批（POST /manage/currency-pair/disable）。源 `currencyPairDisable`。 */
export function disableCurrencyPair(req: CurrencyPairIdReq): Promise<void> {
  return kissenRequest.post('/manage/currency-pair/disable', req);
}

/**
 * 已入网银行支持币种并集（GET /manage/bank/supported-currencies）。
 * 薄调用——源 `api/bank.ts` `bankSupportedCurrencies`，货币对表单币种下拉数据源。
 * 内联于本域（域名域前缀，避免与 bank 域 barrel 导出冲突 + 并行耦合）。
 */
export function getCurrencyPairBankCurrencies(
  config?: AxiosRequestConfig,
): Promise<string[]> {
  return kissenRequest.get<string[]>('/manage/bank/supported-currencies', config);
}

/**
 * 冻结/解冻货币对（POST /manage/freeze/toggle，targetType=3）。
 * 薄调用——源 `api/freeze.ts` `freezeToggle`，货币对列表冻结/解冻行操作。
 * 立即生效不走审批（规格 R-4）；状态校验后端 MSG_21_0067 兜底（仅 20↔50）。
 */
export function toggleCurrencyPairFreeze(
  pairId: number,
  freeze: boolean,
): Promise<void> {
  return kissenRequest.post('/manage/freeze/toggle', {
    targetType: 3,
    targetId: pairId,
    freeze,
  });
}
