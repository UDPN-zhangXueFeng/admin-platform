/**
 * GW（对齐 BP 原型）状态枚举映射：后端状态码 → 原型英文文案 + 业务排序 rank。
 *
 * 文案逐字取自 BP 原型（api-contract.md options 数组 + 页面字面量）；rank 服务
 * 状态列「按业务顺序排序、不按字母」（AGENTS.md §3.3.4），取生命周期序，
 * 未知码排最后（见 protoStatusRank）。plan/12 §7.1：下拉 options 不等后端，
 * 本表即前端唯一字典源；data-access 旧文案层（txStatusText 等）保留不动，
 * 逐页改造时切换到本表。
 */

/** 状态元信息：原型英文文案（逐字）+ 业务排序 rank（小值在前）。 */
export interface ProtoStatusMeta {
  text: string;
  rank: number;
}

/** 交易状态表（BP 原型 transactions options 逐字；对应 tx.model TX_STATUS 码位）。
 * 2026-11-02 终态定名：35（目标端入账）即成功终态，文案 'Completed'；40 为历史码，仅存量数据。 */
export const PROTO_TX_STATUS: Record<number, ProtoStatusMeta> = {
  1: { text: 'Created', rank: 0 },
  5: { text: 'Quoted', rank: 1 },
  10: { text: 'Confirmed', rank: 2 },
  20: { text: 'Source transfer in progress', rank: 3 },
  25: { text: 'Source verified', rank: 4 },
  30: { text: 'Disbursing', rank: 5 },
  35: { text: 'Completed', rank: 6 },
  40: { text: 'Completed (legacy)', rank: 7 },
  50: { text: 'Reversing', rank: 8 },
  60: { text: 'Reversed', rank: 9 },
  90: { text: 'Failed', rank: 10 },
  80: { text: 'Cancelled', rank: 11 },
  70: { text: 'Exception', rank: 12 },
};

/** Token 状态（BP 原型 tokens options 逐字；码位 = token.model TOKEN_STATUS）。 */
export const PROTO_TOKEN_STATUS: Record<number, ProtoStatusMeta> = {
  5: { text: 'Pending Review', rank: 0 },
  20: { text: 'Active', rank: 1 },
  15: { text: 'Rejected', rank: 2 },
  50: { text: 'Disabled', rank: 3 },
};

/** Token Pair 状态（BP 原型 FX Query：Enabled/Disabled；码位 = fx.model
 * status 20 启用 / 50 停用(冻结)）。 */
export const PROTO_PAIR_STATUS: Record<number, ProtoStatusMeta> = {
  20: { text: 'Enabled', rank: 0 },
  50: { text: 'Disabled', rank: 1 },
};

/** 银行入网状态（BP 原型 bank_profile.status 默认 'Approved'；码位 =
 * bank.model BANK_ONBOARD_STATUS；'Not Onboarded' 为本系统前置态，原型无对应词）。 */
export const PROTO_BANK_ONBOARD_STATUS: Record<number, ProtoStatusMeta> = {
  0: { text: 'Not Onboarded', rank: 0 },
  5: { text: 'Pending Review', rank: 1 },
  15: { text: 'Rejected', rank: 2 },
  20: { text: 'Approved', rank: 3 },
};

/** 操作日志结果（BP 原型 Operation Logs Result 列：Success/Failed；码位 =
 * log.model status 0 正常 / 1 异常）。 */
export const PROTO_LOG_RESULT: Record<number, ProtoStatusMeta> = {
  0: { text: 'Success', rank: 0 },
  1: { text: 'Failed', rank: 1 },
};

/** 用户状态（0 Active / 1 Disabled → 原型展示词 Inactive，plan/12 §7.1
 * 「Disabled 废除」；原型 UserManagementPage USER_STATUS_LABEL 同映射）。 */
export const PROTO_USER_STATUS: Record<number, ProtoStatusMeta> = {
  0: { text: 'Active', rank: 0 },
  1: { text: 'Inactive', rank: 1 },
};

/** 角色状态（与用户同码同词，原型 RoleManagementPage ROLE_STATUS_LABEL 同映射）。 */
export const PROTO_ROLE_STATUS: Record<number, ProtoStatusMeta> = {
  0: { text: 'Active', rank: 0 },
  1: { text: 'Inactive', rank: 1 },
};

/** 空值统一 '-'（与 kit/orDash、proto-format 空值口径一致）。 */
const EMPTY_TEXT = '-';

/** 未知码的排序 rank：排在所有已知状态之后（稳定性排序时兜底）。 */
export const PROTO_RANK_UNKNOWN = Number.MAX_SAFE_INTEGER;

/** 状态码 → 原型文案；null/undefined → '-'，未知码 → `Unknown (N)`。 */
export function protoStatusText(
  map: Record<number, ProtoStatusMeta>,
  code: number | null | undefined,
): string {
  if (code === null || code === undefined) return EMPTY_TEXT;
  return map[code]?.text ?? `Unknown (${code})`;
}

export function protoStatusRank(
  map: Record<number, ProtoStatusMeta>,
  code: number | null | undefined,
): number {
  if (code === null || code === undefined) return PROTO_RANK_UNKNOWN;
  return map[code]?.rank ?? PROTO_RANK_UNKNOWN;
}
