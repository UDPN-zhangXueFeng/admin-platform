/** 监控命中行（源 api/risk-monitor.ts MonitorHitRow，对齐 risk_monitor_hit DDL）。 */
export interface MonitorHitRow {
  hitId: number;
  transactionId: number;
  /** 监控规则编码（risk_monitor_rule seed 内置 3 条，编码值以后端 seed 为准）。 */
  ruleCode: string;
  hitDesc: string;
  /** 处理状态：1 待复核 / 2 已复核 / 3 忽略（DDL handle_status；命中仅观察，状态由后端写）。 */
  handleStatus: number;
  /** 命中时间（毫秒）。 */
  createTime: number;
}

/** 命中过滤（全部可选）。 */
export interface MonitorHitFilter {
  ruleCode?: string;
  transactionId?: number;
}

/** 监控命中分页列表请求体。 */
export interface MonitorHitListReq {
  pageNum: number;
  pageSize: number;
  filter: MonitorHitFilter;
}

/**
 * 监控规则编码本地映射（risk_monitor_rule seed 内置 3 条，M14 定稿 C-2）。
 * 未知编码兜底原样显示，不白屏。
 */
export const RULE_CODE_MAP: Record<string, string> = {
  HIGH_FREQ_SMALL: '高频小额',
  SELF_TRANSFER: '关联交易',
  ABNORMAL_AMOUNT: '异常金额',
};

/**
 * 命中处理状态本地映射（域私有语义，不复用 COMMON_STATUS_MAP：
 * 命中处理状态编号空间与审批主表冲突，仿 reconcile 页 DIFF_STATUS_MAP 惯例）。
 */
export const HANDLE_STATUS_MAP: Record<number, string> = {
  1: '待复核',
  2: '已复核',
  3: '忽略',
};


/**
 * 处理状态 → Badge variant（源 handleStatusTagType 映射）。
 * 2 已复核 success=default / 1 待复核 warning=secondary / 其余(3 忽略) info=outline。
 */
export function handleStatusVariant(
  status: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 2) return 'default';
  if (status === 1) return 'secondary';
  return 'outline';
}
