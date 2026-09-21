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

/** 刷新响应：本次增量同步落库条数；failedDomains 非空=部分域失败（f0d5b6f 批 4d27ccf，成功域照常 applied）。 */
export interface SyncRefreshResp {
  domain: string;
  applied: number;
  /** CSV 域串（如 "rate,topup"）；全部成功时缺省。 */
  failedDomains?: string;
}

/**
 * 按域增量同步（POST /lp/sync/refresh?domain=X body {}）。f0d5b6f 批
 * 4d27ccf 起 domain 支持数组（CSV 拼接），一次拉齐页面全部依赖域。
 */
export function postSyncRefresh(
  domain: SyncDomainCode | SyncDomainCode[],
  config?: AxiosRequestConfig,
): Promise<SyncRefreshResp> {
  const domains = Array.isArray(domain) ? domain.join(',') : domain;
  return lpRequest.post<SyncRefreshResp>(
    '/sync/refresh',
    {},
    { ...config, params: { ...config?.params, domain: domains } },
  );
}
