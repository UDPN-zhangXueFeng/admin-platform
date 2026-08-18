/**
 * 货币对域 raw API 层（源 `api/business.ts` currencyPairs）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type { CurrencyPair } from './currencypair.model';

/** 货币对列表（GET /currencypair/list）。 */
export function getCurrencypairList(
  config?: AxiosRequestConfig,
): Promise<CurrencyPair[]> {
  return kissenRequest.get<CurrencyPair[]>('/currencypair/list', config);
}
