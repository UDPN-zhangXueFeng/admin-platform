/** 与后端对账差异列表行 VO 对齐（reconcile_diff + 处理人名称联查回填）。源 api/reconcile.ts。 */
export interface ReconcileDiffRow {
  diffId: number;
  /** 对账日期：GMT+8 当日 00:00 毫秒 */
  reconDate: number;
  /** 1 时间轴缺失 / 2 结算流水缺失 / 3 金额不自洽 / 4 链路异常 */
  diffType: number;
  transactionId: number;
  expected: string;
  actual: string;
  /** 1 待处理 / 2 已确认 / 3 已忽略 */
  status: number;
  /** 0 = 未处理 */
  reviewUserId: number;
  /** 处理人名称；reviewUserId=0 时为空串 */
  reviewUserName: string;
  /** 0 = 未处理 */
  reviewTime: number;
  reviewRemarks: string;
  createTime: number;
}

/** 差异列表筛选条件（全部可选）。 */
export interface ReconcileDiffFilter {
  reconDate?: number;
  diffType?: number;
  status?: number;
  transactionId?: number;
}

export interface ReconcileDiffListReq {
  pageNum: number;
  pageSize: number;
  filter: ReconcileDiffFilter;
}

/** 执行对账请求；reconDate 缺省 = 昨日（GMT+8，后端缺省）。 */
export interface ReconcileRunReq {
  reconDate?: number;
}

/** 执行对账响应：返回差异条数。 */
export interface ReconcileRunResult {
  diffCount: number;
}

/** 处理差异：reviewAction 2 确认 / 3 忽略。 */
export interface ReconcileReviewReq {
  diffId: number;
  reviewAction: 2 | 3;
  reviewRemarks?: string;
}

/** 差异类型本地映射（规格 §2.2，域内私有）。源 DIFF_TYPE_MAP。 */
export const RECONCILE_DIFF_TYPE_LABEL: Record<number, string> = {
  1: '时间轴缺失',
  2: '结算流水缺失',
  3: '金额不自洽',
  4: '链路异常',
};

/**
 * 差异状态本地映射（不复用 COMMON_STATUS_MAP；规格 §2.2）。
 * 源 DIFF_STATUS_MAP：1 待处理 / 2 已确认 / 3 已忽略。
 */
export const RECONCILE_DIFF_STATUS_LABEL: Record<number, string> = {
  1: '待处理',
  2: '已确认',
  3: '已忽略',
};

/** 差异状态 → Badge variant（已确认=default，待处理=secondary，已忽略=outline）。 */
export const RECONCILE_DIFF_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'secondary',
  2: 'default',
  3: 'outline',
};
