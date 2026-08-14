/**
 * Transaction 域模型（源 `api/transaction.ts` 内联类型 + 状态映射）。
 *
 * 与后端 `tx_transaction` 联查 `fx_currency_pair/lp_info/bank_info` 的视图对齐。
 * 所有 BigDecimal 字段后端序列化为 JSON number 或字符串，前端统一用 `string | number`。
 */

/** TransactionStatusEnum：交易生命周期状态码（源注释 13 值）。 */
export const TxStatus = {
  Created: 1,
  Quoted: 5,
  Confirmed: 10,
  SourceTransferring: 20,
  SourceVerified: 25,
  Advancing: 30,
  Settled: 35,
  Completed: 40,
  Reversing: 50,
  Reversed: 60,
  Exception: 70,
  Cancelled: 80,
  Failed: 90,
} as const;

/** 状态码 → 中文标签（源 `TRANSACTION_STATUS_MAP`，列表/详情/事件流共用）。 */
export const TRANSACTION_STATUS_LABEL: Record<number, string> = {
  1: '已创建',
  5: '已报价',
  10: '已确认',
  20: '源端划转中',
  25: '源端已验证',
  30: '解付中',
  35: '已入账',
  40: '已完成',
  50: '冲正中',
  60: '已冲正',
  70: '异常',
  80: '已取消',
  90: '失败',
};

/**
 * 状态码 → Badge variant（源 `txStatusTagType` 语义分层映射）。
 * 入账/完成 → default（成功）；冲正中 → secondary（警示）；已冲正/已取消 → outline（中性灰）；
 * 异常/失败 → destructive；在途（1~30）→ secondary。
 */
export const TRANSACTION_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  35: 'default',
  40: 'default',
  50: 'secondary',
  60: 'outline',
  80: 'outline',
  70: 'destructive',
  90: 'destructive',
};

/** 状态筛选下拉选项（全 13 值；value 为字符串供 Select 使用）。 */
export const TX_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  1, 5, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90,
].map((v) => ({ value: String(v), label: TRANSACTION_STATUS_LABEL[v] ?? String(v) }));

/** 与后端 TransactionRespVO 对齐（tx_transaction 联查 pair/lp/bank）。 */
export interface TransactionRow {
  transactionId: number;
  txUuid: string;
  /** 交易单号（KSN+yyyyMMdd+6 位序号）；存量未回填时为空串。 */
  txNo: string;
  pairId: number;
  /** pairId=0 或货币对行缺失时为空串。 */
  sourceCurrency: string;
  targetCurrency: string;
  lpId: number;
  lpName: string;
  sourceBankId: number;
  sourceBankName: string;
  targetBankId: number;
  targetBankName: string;
  status: number;
  principal: string | number;
  markupRate: string | number;
  userDeduction: string | number;
  baseRate: string | number;
  receiverAmount: string | number;
  userRate: string | number;
  createTime: number;
  /** 0 = 未完成。 */
  completedTime: number;
}

/** 与后端 TransactionDetailRespVO 对齐（TransactionRespVO 全字段 + 详情字段）。 */
export interface TransactionDetailRow extends TransactionRow {
  quoteVersion: number;
  /** 以下时间均为毫秒，0 = 未发生。 */
  quoteExpireTime: number;
  confirmExpireTime: number;
  senderAccount: string;
  receiverAccount: string;
  sourceCsTxId: string;
  targetCsTxId: string;
  confirmTime: number;
  sourceVerifiedTime: number;
  advancingTime: number;
  settledTime: number;
  failReason: string;
  remark: string;
}

/** 与后端 TransactionStageVO 对齐（chain 阶段轴；缺失 step 由前端按未开始补齐）。 */
export interface TransactionStage {
  /** 阶段序号 1-8：报价/确认/源端划转/源端验证/垫资解付/入账/结算/完成。 */
  step: number;
  /** 阶段状态 1 未开始 / 2 进行中 / 3 成功 / 4 失败 / 5 跳过。 */
  status: number;
  /** 毫秒时间戳，0 = 未开始。 */
  startTime: number;
  /** 毫秒时间戳，0 = 未结束。 */
  endTime: number;
  operator: string;
  csTxId: string;
  remark: string;
}

/** 与后端 TransactionFlowNodeVO 对齐（chain 事件流，flat；step=0 为通用事件）。 */
export interface TransactionFlowEvent {
  flowId: number;
  /** 归属阶段 1-8；0 = 不归属任一阶段的通用事件。 */
  step: number;
  /** 1 环节(状态迁移) / 2 动作 / 3 报文 / 4 重试。 */
  nodeType: number;
  statusFrom: number;
  statusTo: number;
  /** 发生时间（毫秒）。 */
  eventTime: number;
  operator: string;
  csTxId: string;
  remark: string;
  traceId: string;
}

/** 与后端 TransactionChainRespVO 对齐（交易主体 + 阶段轴 + flat 事件）。 */
export interface TransactionChainResp {
  transaction: TransactionDetailRow;
  stages: TransactionStage[];
  events: TransactionFlowEvent[];
}

/** 分页筛选条件（全部可选；createTimeStart/End 毫秒，半开 [start, end)）。 */
export interface TransactionPageFilter {
  transactionId?: number;
  txUuid?: string;
  /** 交易单号精确匹配。 */
  txNo?: string;
  pairId?: number;
  lpId?: number;
  sourceBankId?: number;
  targetBankId?: number;
  status?: number;
  createTimeStart?: number;
  createTimeEnd?: number;
}

/** 列表查询请求（喂 `kissenPage`）。 */
export interface TransactionListReq {
  pageNum: number;
  pageSize: number;
  filter: TransactionPageFilter;
}

/** EXCEPTION(70) 人工裁定请求（源 `/manage/transaction/resolve`）。 */
export interface TransactionResolveReq {
  txId: number;
  /** 1 完成 / 2 失败 / 3 冲正完成。 */
  action: 1 | 2 | 3;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* 跨域下拉选项投影（薄调用，避免 import 他组 data-access）            */
/* ------------------------------------------------------------------ */

/** LP 下拉选项投影（源 `lpList` → 仅取筛选所需字段）。 */
export interface TxLpOption {
  lpId: number;
  lpName: string;
  lpCode: string;
}

/** 货币对下拉选项投影（源 `currencyPairList`）。 */
export interface TxPairOption {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
}

/** 银行下拉选项投影（源 `bankList`）。 */
export interface TxBankOption {
  bankId: number;
  bankName: string;
}
