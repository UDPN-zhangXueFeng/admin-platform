/**
 * 统计概览域模型（源 `types/overview.ts` + `views/overview/index.vue` period 切换）。
 *
 * 口径：本实例本地 gw_tx_record/gw_token_info/gw_token_pair，非全网统计。
 */

import type { TxRecord } from '../tx/tx.model';

/** 统计概览（GET /overview，FR-BM-05-1）。 */
export interface OverviewStats {
  /** 实际统计窗口（毫秒时间戳）。 */
  from: number;
  to: number;
  totalCount: number;
  /** 已完成（40）。 */
  completedCount: number;
  /** 失败（90）。 */
  failedCount: number;
  /** 已冲正（60）。 */
  reversedCount: number;
  /** 异常待人工（70）。 */
  exceptionCount: number;
  /** 待处理（pendingFlag=1）。 */
  pendingCount: number;
  /** completed/totalCount，无交易为 null。 */
  successRate?: number | null;
  /** 状态 → 笔数。 */
  statusDistribution: Record<string, number>;
  /** 本行为源端（bankRole=1）。 */
  sourceCount: number;
  /** 源端本金合计（源 token 计价）。 */
  sourcePrincipalSum: number;
  /** 本行为目标端（bankRole=2）。 */
  targetCount: number;
  /** 目标端本金合计。 */
  targetPrincipalSum: number;
  /** 本行已注册 token 总数。 */
  tokenTotal: number;
  /** token 分状态数量（5 待审核/20 已生效/15 已驳回/50 已停用）。 */
  tokenByStatus: Record<string, number>;
  /** 本行相关 token 对数。 */
  tokenPairCount: number;
  /** 最近交易动态（最新 10 条）。 */
  recentTxs: TxRecord[];
  /** 交易量逐日时序（UDPN Dashboard 折线图数据源；日期轴按本地日连续生成，无交易日补 0）。 */
  volumeSeries: VolumeDayPoint[];
}

/** 交易量单日数据点：byPair key=token 对编码（pairCode），bySymbol key=源端币种 symbol；
 *  无法归属 pair/币种的交易计入 UNKNOWN 键，任一维度求和=当日交易总数。 */
export interface VolumeDayPoint {
  /** 日期 yyyy-MM-dd。 */
  date: string;
  byPair: Record<string, number>;
  bySymbol: Record<string, number>;
}

/** 统计窗口筛选参数。period：TODAY / 7D / 30D / CUSTOM（空或非法回退 7D）；CUSTOM 时带 from/to 毫秒。 */
export interface OverviewReq {
  period?: string;
  from?: number;
  to?: number;
}

/** 统计窗口可选值（源 `views/overview/index.vue` el-radio-button，默认 7D）。 */
export type OverviewPeriod = 'TODAY' | '7D' | '30D' | 'CUSTOM';

/** 统计窗口选项（英文文案，无 CJK）。 */
export const OVERVIEW_PERIOD_OPTIONS: ReadonlyArray<{ value: OverviewPeriod; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: '7D', label: 'Last 7 Days' },
  { value: '30D', label: 'Last 30 Days' },
  { value: 'CUSTOM', label: 'Custom' },
];

/** 统计窗口默认值（源 period = ref('7D')）。 */
export const OVERVIEW_PERIOD_DEFAULT: OverviewPeriod = '7D';

/** 统计窗口文案；未知/非法值 → 'Last 7 Days' 兜底（与接口回退口径一致）。 */
export function overviewPeriodText(period?: string): string {
  if (period == null) return 'Last 7 Days';
  return OVERVIEW_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Last 7 Days';
}
