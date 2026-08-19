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
  /** CommonStatusEnum 值域：5 待审 / 10 审中 / 15 拒绝 / 20 已确认 / 35 已结算 */
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

/**
 * 生成结算单请求。periodStart/periodEnd 毫秒可选，留空用后端缺省窗口；
 * 重复 -> MSG_21_0060，空窗口 -> MSG_21_0062（源 api 注释）。
 */
export interface SettleOrderGenerateReq {
  lpId: number;
  periodType: number;
  periodStart?: number;
  periodEnd?: number;
}

/** 提交结算单确认审批（KSC）；仅 status 5/15 可操作。 */
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
 * 结算单状态标签（CommonStatusEnum 子集）。源用 approval/status.ts 的
 * COMMON_STATUS_MAP（"以 Vue 源码为唯一事实来源"，状态列/详情均取其文案，不 override）。
 */
export const SETTLE_ORDER_STATUS_LABEL: Record<number, string> = {
  5: 'Pending Review',
  10: 'Under Review',
  15: 'Rejected',
  20: 'Approved',
  35: 'Final Confirmation',
};

/** 结算单状态下拉选项值域（源 SETTLE_STATUS_OPTIONS）。 */
export const SETTLE_ORDER_STATUS_VALUES = [5, 10, 15, 20, 35] as const;

/** 结算单状态 → Badge variant（约定 §5：通过/已结算=default，拒绝=destructive，待审/审中=secondary）。 */
export const SETTLE_ORDER_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'secondary',
  10: 'secondary',
  15: 'destructive',
  20: 'default',
  35: 'default',
};

/**
 * LP 选项（跨域薄调用类型，仅取所需字段）。源 generate-dialog / index.vue 用
 * api/lp.ts 的 lpList；为避免并行耦合他组 data-access，本域自写薄调用。
 */
export interface SettleLpOption {
  lpId: number;
  lpName: string;
  lpCode: string;
}
