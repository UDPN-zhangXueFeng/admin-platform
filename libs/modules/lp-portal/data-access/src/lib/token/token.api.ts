/**
 * LP Token 总览域 raw API 层（源 `src/api/token.ts` 1:1）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/token/list、
 * GET /lp/token/bank-group）；全局域本地副本，lpId 由后端登录态标注 pooled。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { BankGroupRow, TokenRow } from '../types';

/** 视图一：token 列表（默认已生效，含「我已开通」pooled 标注；body {}）。 */
export function getTokenList(config?: AxiosRequestConfig): Promise<TokenRow[]> {
  return lpRequest.post<TokenRow[]>('/token/list', {}, config);
}

/** 视图二：按银行分组（GET，不分页全量）。 */
export function getBankTokenGroups(
  config?: AxiosRequestConfig,
): Promise<BankGroupRow[]> {
  return lpRequest.get<BankGroupRow[]>('/token/bank-group', config);
}
