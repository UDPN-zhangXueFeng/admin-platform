/** 与后端 SplitTransferRespVO 对齐（settle_split_transfer 联查 lp_info）。源 api/split-transfer.ts。 */
export interface SplitTransferRow {
  transferId: number;
  orderId: number;
  lpId: number;
  lpName: string;
  /** 1 Kissen 凭预授权划转 / 2 LP 主动划转（当前后端恒写 1） */
  direction: number;
  /** 源币种；窗口内无交易时为空串 */
  currency: string;
  amount: string | number;
  /** 货币系统交易 ID；初始空串，模拟值 SIMULATED-SPLIT-{transferId} 原样展示 */
  csTxId: string;
  /** 域内私有状态：1 处理中 / 2 成功 / 3 失败（非 CommonStatusEnum，不可复用全局映射） */
  status: number;
  /** 关联 KST 审批记录 ID；0 = 未发起审批 */
  approvalRecordId: number;
  createTime: number;
}

/** 分成划转分页筛选（全部可选）。 */
export interface SplitTransferListFilter {
  orderId?: number;
  lpId?: number;
  status?: number;
}

export interface SplitTransferListReq {
  pageNum: number;
  pageSize: number;
  filter: SplitTransferListFilter;
}

/** 发起分成划转（KST）；仅 status=20 结算单可发起。 */
export interface SplitTransferSaveReq {
  orderId: number;
}

/**
 * 分成划转状态标签（域内私有，源 SPLIT_STATUS_MAP：1 处理中 / 2 成功 / 3 失败）。
 * 规格标注「不可复用全局映射」，故域内独立维护。
 */
export const SPLIT_STATUS_LABEL: Record<number, string> = {
  1: '处理中',
  2: '成功',
  3: '失败',
};

/** 分成划转状态 → Badge variant（成功=default，失败=destructive，处理中=secondary）。 */
export const SPLIT_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'secondary',
  2: 'default',
  3: 'destructive',
};

/** 方向映射（源 DIRECTION_MAP：1 Kissen 凭预授权划转 / 2 LP 主动划转）。 */
export const SPLIT_DIRECTION_LABEL: Record<number, string> = {
  1: 'Kissen 凭预授权划转',
  2: 'LP 主动划转',
};

/** LP 选项（跨域薄调用类型，仅取所需字段）。 */
export interface SplitLpOption {
  lpId: number;
  lpName: string;
  lpCode: string;
}
