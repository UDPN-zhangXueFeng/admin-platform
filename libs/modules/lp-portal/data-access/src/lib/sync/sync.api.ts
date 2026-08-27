/**
 * LP 数据同步域 raw API 层（源 `src/api/sync.ts` refresh 1:1）。
 *
 * 按域增量同步（seq > 游标），返回落库条数；`GET /sync/status` 源中全仓
 * 无消费方，不建 api 函数（裁决同 pool/detail O-9）。lpId 由后端登录态处理，
 * 前端不传。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';

/** 同步域枚举（源 SyncDomainCode；split 复用 pair、settle 单据刷 settle_order）。 */
export type SyncDomainCode =
  | 'token'
  | 'bank'
  | 'rate'
  | 'pool'
  | 'topup'
  | 'preauth'
  | 'pair'
  | 'tx_flow'
  | 'settle_record'
  | 'settle_order';

/** 刷新响应：本次增量同步落库条数。 */
export interface SyncRefreshResp {
  domain: string;
  applied: number;
}

/** 按域增量同步（POST /lp/sync/refresh?domain=X body {}）。 */
export function postSyncRefresh(
  domain: SyncDomainCode,
  config?: AxiosRequestConfig,
): Promise<SyncRefreshResp> {
  return lpRequest.post<SyncRefreshResp>(
    '/sync/refresh',
    {},
    { ...config, params: { ...config?.params, domain } },
  );
}
