/**
 * LP 预授权域模型（源 `src/types/business.ts` PreauthRow + `views/preauth/index.vue`
 * §D5 只读快照页码表）。
 *
 * `/preauth/list` 为快照表全量列表（非 ResultData 内的分页包，源 body 透传
 * {poolId?}）。字段沿用本仓裁决口径：源 tokenCode → currency、金额按 number
 * 直读（settle/rate 域同款），不再保留 string 双形态。
 *
 * 页面仅展示列需要的字段入库；validTo 允许 null（快照未设置有效期 → 列显 '-'）。
 */

/** 预授权列表请求体（源 preauthApi.list({poolId?})；不传 = 全量）。 */
export interface PreauthListReq {
  /** 资金池 ID 筛选；undefined 不进请求体 */
  poolId?: number;
}

/** 预授权快照行（源 PreauthRow 1:1 平移，本仓口径调整见头注）。 */
export interface PreauthRow {
  preauthId: number;
  poolId: number;
  /** 所属币种（源 tokenCode，本仓币种口径统一改名） */
  currency: string;
  /** 授权额度 */
  authAmount: number;
  /** 已用额度 */
  usedAmount: number;
  /** 可代转额度 */
  availableAmount: number;
  /** 剩余额度 = 授权 − 已用（后端直出） */
  remaining: number;
  /** 有效期至（毫秒时间戳）；null = 未设置，页面显 '-' */
  validTo: number | null;
  /** 快照时间（毫秒时间戳） */
  snapshotTime: number;
}
