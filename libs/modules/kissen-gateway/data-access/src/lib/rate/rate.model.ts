/**
 * 汇率域数据模型（源 `types/business.ts` RateSnapshot，gw_rate_snapshot 推送缓存）。
 */

/** 最新汇率快照（GET /rate/list?pairId=，单对象）。 */
export interface RateSnapshot {
  snapshotId?: number;
  pairId: number;
  baseRate: number;
  markupRate: number;
  userRate: number;
  version?: number;
  pushTime?: number;
}
