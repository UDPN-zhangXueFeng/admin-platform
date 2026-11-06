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
  /** 成功终态：目标端入账即完成（2026-11-02 起状态名为 Completed，码值仍是 35） */
  Completed: 35,
  /** 历史码（2026-09-02 前 35→40 两段式），仅存量数据 */
  LegacyCompleted: 40,
  Reversing: 50,
  Reversed: 60,
  Exception: 70,
  Cancelled: 80,
  Failed: 90,
} as const;

/** 状态码 → 英文标签（列表/详情/事件流共用）。2026-11-02 终态定名：
 * 35（目标端入账）即成功终态，标签 'Completed'；40 为 2026-09-02 前的历史码，仅存量数据可见。 */
export const TRANSACTION_STATUS_LABEL: Record<number, string> = {
  1: 'Created',
  5: 'Quoted',
  10: 'Confirmed',
  20: 'Source transfer in progress',
  25: 'Source verified',
  30: 'Disbursing',
  35: 'Completed',
  40: 'Completed (legacy)',
  50: 'Reversing',
  60: 'Reversed',
  70: 'Exception',
  80: 'Cancelled',
  90: 'Failed',
};

/**
 * 链路节点业务标题（六段，文案与 kissen-gateway `TX_STAGE_EVENT_TITLE` 一致）：
 * step 1~6 = 报价 / 确认 / 源端划转 / 源端验证 / 垫资解付 / 入账。
 * 2026-11-03 三系统统一：链路节点标题用业务动作名，不再用状态码文案。
 */
export const TX_STAGE_EVENT_TITLE: Record<number, string> = {
  1: 'Quote Accepted',
  2: 'User Confirmation',
  3: 'Source Transfer Initiated',
  4: 'Source Arrival Verified',
  5: 'Disbursement Initiated',
  6: 'Credited',
};

/**
 * 链路节点标题：阶段事件（step 1~6）用业务动作名；通用/分支事件
 * （step=0 或历史 7/8）回退状态文案。
 */
export function txStageEventTitle(step: number | null | undefined, statusTo: number): string {
  return (
    TX_STAGE_EVENT_TITLE[step ?? 0] ??
    TRANSACTION_STATUS_LABEL[statusTo] ??
    `Status ${statusTo}`
  );
}

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

/** 状态筛选下拉选项（12 值；40 为历史码，主链路不再产生，不入筛选项）。
 * 2026-10-30 三系统统一：按业务路径序（主路径 → 冲正 → 失败/取消/异常）。 */
export const TX_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  1, 5, 10, 20, 25, 30, 35, 50, 60, 90, 80, 70,
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
  /** 源端付款钱包（FX Transactions 列表 From/To 展示，2026-08-27）。 */
  senderAccount: string;
  receiverAccount: string;
  principal: string | number;
  markupRate: string | number;
  userDeduction: string | number;
  baseRate: string | number;
  receiverAmount: string | number;
  userRate: string | number;
  createTime: number;
  /** 0 = 未完成。 */
  completedTime: number;
  /**
   * 失败/异常原因（2026-11-03 列表补充）：报价或 LP 匹配阶段即失败的行没有 pair/lp/金额，
   * 列表靠这段原文说明为什么失败；成功行为空串。
   */
  failReason?: string | null;
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
  /** LP 源 token 资金池地址（用户源端划转目的地；无池空串，55aa521）。 */
  lpSourcePoolAddress: string;
  /** LP 目标 token 资金池地址（解付资金来源；无池空串）。 */
  lpTargetPoolAddress: string;
  confirmTime: number;
  sourceVerifiedTime: number;
  advancingTime: number;
  settledTime: number;
  failReason: string;
  remark: string;
}

/** 与后端 TransactionStageVO 对齐（chain 阶段轴；缺失 step 由前端按未开始补齐；7e20c04 后 UI 改用事件时间轴，此接口仅随 API 保留）。 */
export interface TransactionStage {
  /** 阶段序号 1-6：报价/确认/源端划转/源端验证/垫资解付/入账（35 即完成收口，2026-09-04 由 8 段合并）。 */
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
  /**
   * 1 完成 / 2 失败 / 3 冲正完成 / 4 重新解付 / 5 退款（LP 源池→付款人）。
   * 4、5 会产生新的划转指令，必须带 verifiedNotReceived=true。
   */
  action: 1 | 2 | 3 | 4 | 5;
  reason?: string;
  /** action=4/5 必填 true：人工已在货币系统核实「原指令未受理」（双付/重复退款闸门）。 */
  verifiedNotReceived?: boolean;
}

/** 裁定前查证结果（POST `/manage/transaction/query-result`）。 */
export interface TxTargetQueryResult {
  transactionId: number;
  status: number;
  targetCsTxId: string;
  /** SUCCESS 只能标记完成；FAILED/NOT_REGISTERED/NO_CREDENTIAL 可重发或退款；PROCESSING 需等待。 */
  result:
    | 'SUCCESS'
    | 'FAILED'
    | 'PROCESSING'
    | 'NOT_REGISTERED'
    | 'NO_CREDENTIAL';
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

/** Token 对下拉选项投影（源 `pairList`/`TokenPairRow`，v2.0 token-pair 域）。 */
export interface TxPairOption {
  pairId: number;
  sourceTokenCode: string;
  /** Symbol abbreviation for display; falls back to sourceTokenCode when absent. */
  sourceSymbol?: string;
  targetTokenCode: string;
  /** Symbol abbreviation for display; falls back to targetTokenCode when absent. */
  targetSymbol?: string;
}

/** 银行下拉选项投影（源 `bankList`）。 */
export interface TxBankOption {
  bankId: number;
  bankName: string;
}
