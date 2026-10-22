/**
 * 原型口径状态枚举映射（方案 12 §3 P0 / §7.1：三 app 各建一份「原型文案 ↔
 * 后端码」映射表，feature 层常量）。
 *
 * - 码 = 本系统后端状态码（data-access 各域 model / types.ts 行注释）；
 * - label = LPP 原型逐字文案（/tmp/kissen_prototype/udpn-kissen-lp-portal，
 *   以 FxTransactionsPage / PoolManagementListPage / TokenPairPage /
 *   RevenueSettlementPage 及 server/lpp-routes.js 实抓为准）；
 * - rank = 业务流水线排序值（demo AGENTS §3.3.4：枚举列按业务状态顺序排，
 *   不按字母；未知码由调用方兜底排最后且稳定）。
 *
 * GAP-X-01：原型要求下拉 options 由接口下发，当前保留前端常量为唯一字典源
 * （有意偏差，登记于《缺口记录》）。结算单第 4 态原型文案为
 * 'Voided & Reopened'（非 'Voided'），与本仓 SETTLE_ORDER_STATUS_LABEL 同码同文。
 */

/** 枚举映射条目：label = 原型英文文案；rank = 业务排序值（小在前）。 */
export interface ProtoEnumEntry {
  label: string;
  rank: number;
}

/**
 * 交易 13 态全表（原型 FxTransactionsPage `FX_STATUSES` 逐字，rank = 数组序；
 * server 端 FX_STATUS_RANK 同款 CASE 排序）。
 * 码语义（types.ts TxRow）：1 已创建 / 5 已报价 / 10 已确认 / 20 源端划转中 /
 * 25 源端已验证 / 30 解付中 / 35 已入账 / 40 已完成 / 50 冲正中 / 60 已冲正 /
 * 70 异常 / 80 已取消 / 90 失败。原型把 35/40 区分为 Credited / Completed 两个
 * 独立态、30 为 Processing——本仓 tx-flow.model 现文案（30 'Disbursing'、
 * 35/40 均 'Completed'）在原型合并后按本表恢复原型口径。
 */
export const LP_TX_STATUS_MAP: Record<number, ProtoEnumEntry> = {
  1: { label: 'Created', rank: 0 },
  5: { label: 'Quoted', rank: 1 },
  10: { label: 'Confirmed', rank: 2 },
  20: { label: 'Source Transferring', rank: 3 },
  25: { label: 'Source Verified', rank: 4 },
  30: { label: 'Processing', rank: 5 },
  35: { label: 'Credited', rank: 6 },
  40: { label: 'Completed', rank: 7 },
  50: { label: 'Reversing', rank: 8 },
  60: { label: 'Reversed', rank: 9 },
  70: { label: 'Abnormal', rank: 10 },
  80: { label: 'Cancelled', rank: 11 },
  90: { label: 'Failed', rank: 12 },
};

/**
 * 池状态（原型 PoolManagementListPage 筛选/列表文案 Active / Inactive）。
 * 5/15 为本仓后端全码覆盖保留（原型池表仅 CHECK Active/Inactive），文案沿用
 * 原型词表 Pending / Rejected；rank 按生命周期 Pending → Active → Inactive →
 * Rejected（终态分支排最后，同 §3.3.4 生命周期先例）。取代 POOL_STATUS_TEXT
 * 的 'Disabled' → 'Inactive' 口径。
 */
export const LP_POOL_STATUS_MAP: Record<number, ProtoEnumEntry> = {
  5: { label: 'Pending', rank: 0 },
  20: { label: 'Active', rank: 1 },
  50: { label: 'Inactive', rank: 2 },
  15: { label: 'Rejected', rank: 3 },
};

/**
 * Token Pair 参与状态（原型 TokenPairPage 筛选 ['Active','Available','Inactive']
 * 文案）。码语义同池域（types.ts PairRow：5 申请中 / 15 已驳回 / 20 参与生效 /
 * 50 停用）。原型 'Available' 为 eligible（可申请）行专属态，本仓「我的 Token
 * 对」列表无对应码（Eligible 页签已裁），不映射。
 */
export const LP_PAIR_STATUS_MAP: Record<number, ProtoEnumEntry> = {
  5: { label: 'Pending', rank: 0 },
  20: { label: 'Active', rank: 1 },
  50: { label: 'Inactive', rank: 2 },
  15: { label: 'Rejected', rank: 3 },
};

/** Pair Readiness 语义键（由行 booleans 推导，见 {@link lpPairReadinessKey}）。 */
export type LpPairReadinessKey = 'poolReady' | 'preauthNotSet';

/**
 * Pair Readiness 文案（原型 token_pairs.pool_readiness CHECK 逐字）：
 * 'Pool ready' / 'Pre-authorization not set'。rank：就绪在前。
 */
export const LP_PAIR_READINESS_MAP: Record<
  LpPairReadinessKey,
  ProtoEnumEntry
> = {
  poolReady: { label: 'Pool ready', rank: 0 },
  preauthNotSet: { label: 'Pre-authorization not set', rank: 1 },
};

/**
 * 行 booleans → Readiness 语义键（原型 dto.js readiness 推导口径）：
 * 双侧池未就绪 → null（原型无徽章，仅 '-'）；就绪且预授权有效 → 'poolReady'；
 * 就绪但预授权未设 → 'preauthNotSet'。
 */
export function lpPairReadinessKey(
  poolReady: boolean,
  preauthOk: boolean,
): LpPairReadinessKey | null {
  if (!poolReady) return null;
  return preauthOk ? 'poolReady' : 'preauthNotSet';
}

/**
 * 结算单 4 态（原型 RevenueSettlementPage `STATEMENT_STATUS_RANK` 逐字，rank 同）。
 * 码语义（types.ts SettleOrderRow）：10 待确认 / 20 已确认 / 35 已结算 /
 * 45 已作废重开；第 4 态原型文案 'Voided & Reopened'。
 */
export const LP_STATEMENT_STATUS_MAP: Record<number, ProtoEnumEntry> = {
  10: { label: 'Pending Confirmation', rank: 0 },
  20: { label: 'Confirmed', rank: 1 },
  35: { label: 'Settled', rank: 2 },
  45: { label: 'Voided & Reopened', rank: 3 },
};

/**
 * 用户状态（原型 UserManagementListPage 文案 Active / Inactive）。本仓
 * UserRow.status 0 正常 / 1 停用——'Normal' / 'Disabled' 废除（方案 §7.1）。
 */
export const LP_USER_STATUS_MAP: Record<number, ProtoEnumEntry> = {
  0: { label: 'Active', rank: 0 },
  1: { label: 'Inactive', rank: 1 },
};

/**
 * 角色状态（原型 RoleManagementPage 文案 Active / Inactive）。本仓 RoleRow
 * 同 0/1 码表，与用户域分表声明（POOL/PAIR 分表先例），未知码由页面显原值。
 */
export const LP_ROLE_STATUS_MAP: Record<number, ProtoEnumEntry> = {
  0: { label: 'Active', rank: 0 },
  1: { label: 'Inactive', rank: 1 },
};

/**
 * 操作日志 result 文案（原型 lpp-data operationLogs result 逐字 Success /
 * Failed）。本仓 LogRow.status：0 正常 / 1 异常；GAP-LP-10 前端本地过滤用。
 */
export const LP_LOG_RESULT_MAP: Record<number, ProtoEnumEntry> = {
  0: { label: 'Success', rank: 0 },
  1: { label: 'Failed', rank: 1 },
};
