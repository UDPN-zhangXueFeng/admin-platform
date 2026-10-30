/**
 * Clearance Pipeline（原型 7 环节；GAP-LP-11 链路拼装）——rail 纯推导逻辑。
 *
 * 从 tx-flow-pages 抽离（渲染与单测共用；样式映射留在页面）。2026-10-30
 * tx125 事故回归锚点：终态事件 30→35（target credited）因 35 不在 RAIL_CODES
 * 被 chainTimes/chainMax 丢弃，Credited 终态交易第 7 环永远 Pending（6/7、86%）。
 */

/** 流水线 7 环节码（原型 steps 对应态）。 */
export const RAIL_CODES = [1, 5, 10, 20, 25, 30, 40] as const;
export const RAIL_CODE_LIST: readonly number[] = RAIL_CODES;
export const RAIL_STEPS = [
  'Created',
  'Quoted',
  'Confirmed',
  'Source Transferring',
  'Source Verified',
  'Processing',
  'Completed',
] as const;

/** 环节描述（原型 stepInfo 逐字）。 */
export const RAIL_STEP_INFO: readonly string[] = [
  'Transaction created and tracked by the system',
  'FX rate locked from the market rate + markup',
  'Payment confirmed by the client bank',
  'Funds moved from the sender bank to the escrow account',
  'Escrow balance verified on-chain',
  'Funds disbursed to the receiver bank',
  'Receiver confirmed the incoming funds',
];

/**
 * 状态 → 流水线索引：rail 内码直映；非 rail 态按业务位置钳制
 * （35 Credited 视同已过 Processing；50/60 冲正系完成/入账后回退；
 * 70/80/90 异常类通常在解付段暴露）。链路真实事件（chainMax）优先于此表。
 */
export const STATUS_RAIL_INDEX: Record<number, number> = {
  1: 0,
  5: 1,
  10: 2,
  20: 3,
  25: 4,
  30: 5,
  35: 6,
  40: 6,
  50: 6,
  60: 6,
  70: 5,
  80: 5,
  90: 5,
};

/**
 * GAP-LP-11：中段环节无链路事件时间时的展示口径（原型 deltaSec），
 * UI 展示口径非业务数据；链路端点补全后自然被真实 eventTime 取代。
 */
export const RAIL_FALLBACK_DELTA_SEC = [0, 5, 8, 20, 32, 45, 52] as const;

export type RailState = 'done' | 'danger' | 'muted' | 'warning' | 'future';

/**
 * 链路事件 statusTo → rail 内码归一：35（Credited）与 40 同为第 7 环
 * Completed，归一后终态事件 30→35 才能计入 chainTimes/chainMax。
 * 其余码（含 50-90 分支/异常态）原样返回——rail 推进只认主线事件，
 * 异常态的位置由行内状态经 STATUS_RAIL_INDEX 兜底，避免把源端失败
 * （如 20→90）误推到解付环。
 */
export function chainEventRailCode(statusTo: number): number {
  return statusTo === 35 ? 40 : statusTo;
}

/** Completed/credited statuses finalize the current node; later stages stay future. */
export function railState(
  status: number,
  statusLabel: string | undefined,
  index: number,
  stageIndex: number,
): RailState {
  if (index < stageIndex) return 'done';
  if (index > stageIndex) return 'future';
  if (status === 35 || status === 40 || statusLabel === 'Completed') return 'done';
  if (statusLabel === 'Abnormal' || statusLabel === 'Failed') return 'danger';
  if (
    statusLabel === 'Cancelled' ||
    statusLabel === 'Reversed' ||
    statusLabel === 'Reversing'
  ) {
    return 'muted';
  }
  return 'warning';
}
