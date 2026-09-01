/** 与后端 SettleOrderRespVO 对齐（settle_order 联查 lp_info）。源 api/settle-order.ts。 */
export interface SettleOrderRow {
  orderId: number;
  lpId: number;
  lpName: string;
  /** 1 日 / 2 周 / 3 月 */
  periodType: number;
  /** 毫秒 */
  periodStart: number;
  periodEnd: number;
  txCount: number;
  principalTotal: string | number;
  markupTotal: string | number;
  /** 管理侧分成合计（即划转金额） */
  adminSplitTotal: string | number;
  lpSplitTotal: string | number;
  /** v2.0 状态机（DEC-08）：10 待确认 / 20 已确认(KSC) / 35 已结算(KST) / 45 作废 */
  status: number;
  /** 关联 KSC 审批记录 ID；0 = 未发起审批，判空用 !id */
  approvalRecordId: number;
  createTime: number;
}

/** 结算单分页筛选（全部可选）。 */
export interface SettleOrderListFilter {
  lpId?: number;
  periodType?: number;
  status?: number;
}

export interface SettleOrderListReq {
  pageNum: number;
  pageSize: number;
  filter: SettleOrderListFilter;
}

/** 提交结算单确认审批（KSC）；仅 status 10 待确认可操作（确认前勾稽校验，不一致阻止）。 */
export interface SettleOrderConfirmReq {
  orderId: number;
}

/** 周期类型映射（源 index.vue PERIOD_TYPE_MAP：1 日 / 2 周 / 3 月）。 */
export const SETTLE_PERIOD_TYPE_LABEL: Record<number, string> = {
  1: 'Daily',
  2: 'Weekly',
  3: 'Monthly',
};

/**
 * 结算单状态标签。v2.0 换 DEC-08 状态机 {10,20,35,45}（§G 裁决15）：
 * 源 index.vue SETTLE_STATUS_MAP / SETTLE_STATUS_OPTIONS 逐条照迁（英文定稿见任务报告）。
 */
export const SETTLE_ORDER_STATUS_LABEL: Record<number, string> = {
  10: 'Pending Confirmation',
  20: 'Confirmed',
  35: 'Settled',
  45: 'Voided',
};

/** 结算单状态下拉选项值域（源 SETTLE_STATUS_OPTIONS = [10,20,35,45]）。 */
export const SETTLE_ORDER_STATUS_VALUES = [10, 20, 35, 45] as const;

/**
 * 结算单状态 → Badge variant。源 statusTagType：20/35 success→default、
 * 10 warning→secondary、45（未匹配）info→outline。
 */
export const SETTLE_ORDER_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  10: 'secondary',
  20: 'default',
  35: 'default',
  45: 'outline',
};

/** 作废结算单请求（v2.0/AD-25：仅 status 10 → 45；作废后同周期可重新生成）。 */
export interface SettleOrderVoidReq {
  orderId: number;
}

/**
 * 结算单分项（v2.0：金额下沉 token 对分项 + 调整项；源 SettleOrderItemRow 照抄）。
 * 金额为各 token 对自身货币单位，跨对不可加总。
 */
export interface SettleOrderItemRow {
  itemId: number;
  itemType: number;
  pairId: number;
  pairCode: string;
  sourceTokenCode: string;
  targetTokenCode: string;
  txCount: number;
  principalTotal: string | number;
  markupTotal: string | number;
  adminSplitTotal: string | number;
  lpSplitTotal: string | number;
  sourceTransactionId: number;
  remark: string;
}

/** 分项类型（源 SETTLE_ITEM_TYPE_MAP：1 Token 对分项 / 2 调整项）。 */
export const SETTLE_ITEM_TYPE_LABEL: Record<number, string> = {
  1: 'Token pair item',
  2: 'Adjustment item',
};

/**
 * token 对分项逐笔结算明细（该单周期 × 该 pair 的结算流水，含交易单号；
 * 源 SettleItemRecordRow，2026-08-28）。
 */
export interface SettleItemRecordRow {
  txNo: string;
  principal: string | number;
  markupAmount: string | number;
  adminSplitAmount: string | number;
  lpSplitAmount: string | number;
  /** 毫秒 */
  recordTime: number;
}

/**
 * LP 选项（跨域薄调用类型，仅取所需字段）。源 index.vue 用
 * api/lp.ts 的 lpList；为避免并行耦合他组 data-access，本域自写薄调用。
 */
export interface SettleLpOption {
  lpId: number;
  lpName: string;
  lpCode: string;
}
