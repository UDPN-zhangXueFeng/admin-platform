/**
 * Tx 域模型（源 `types/business.ts` TxRecord/TxListReq/TxMessage + `views/tx/list.vue` 状态映射）。
 */

/** Badge variant 约定（kissen 家族语义分层，Element tag type 映射见各映射表注释）。 */
export type TxVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 交易记录筛选条件（POST /tx/page，全部可选；startTime/endTime 为毫秒时间戳）。 */
export interface TxListReq {
  pairId?: number;
  status?: number;
  /** 1=仅看待处理；不传=全部。 */
  pendingFlag?: number;
  startTime?: number;
  endTime?: number;
}

/** 列表查询请求（喂 kissenPage）。 */
export interface TxPageReq {
  pageNum: number;
  pageSize: number;
  filter?: TxListReq;
}

/**
 * 本行相关交易本地缓存（gw_tx_record）。
 * bankRole：1 源端 / 2 目标端；status 对齐 TransactionStatusEnum；pendingFlag：0 无 / 1 待处理。
 */
export interface TxRecord {
  recordId: number;
  transactionId: number;
  bankRole?: number;
  pairId?: number;
  principal?: number;
  status?: number;
  sourceCsTxId?: string;
  targetCsTxId?: string;
  pendingFlag?: number;
  pendingReason?: string;
  lastSyncTime?: number;
  createTime?: number;
  createUserId?: number;
  updateTime?: number;
  updateUserId?: number;
}

/**
 * 报文留痕（gw_message_record）。
 * direction：1 入向(Kissen→本) / 2 出向(本→Kissen)；processStatus：1 处理中 / 2 成功 / 3 失败。
 */
export interface TxMessage {
  msgId: number;
  transactionId: number;
  msgType?: number;
  direction?: number;
  idempotentKey?: string;
  processStatus?: number;
  payloadDigest?: string;
  traceId?: string;
  createTime?: number;
  updateTime?: number;
}

/**
 * 交易状态（对齐后端 TransactionStatusEnum，源 `views/tx/list.vue` TX_STATUS）。
 * variant 分层映射：Element info→outline、primary/warning→secondary、success→default、danger→destructive。
 */
export const TX_STATUS: Record<number, { text: string; variant: TxVariant }> = {
  1: { text: '已创建', variant: 'outline' },
  5: { text: '已报价', variant: 'secondary' },
  10: { text: '已确认', variant: 'secondary' },
  20: { text: '源端划转中', variant: 'secondary' },
  25: { text: '源端到账已验证', variant: 'secondary' },
  30: { text: '解付中', variant: 'secondary' },
  35: { text: '已入账', variant: 'default' },
  40: { text: '已完成', variant: 'default' },
  50: { text: '冲正中', variant: 'secondary' },
  60: { text: '已冲正', variant: 'outline' },
  70: { text: '异常(需人工)', variant: 'destructive' },
  80: { text: '已取消', variant: 'outline' },
  90: { text: '失败', variant: 'destructive' },
};

/** 状态筛选下拉选项（全 13 值；value 为字符串供 Select 使用）。 */
export const TX_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  Object.entries(TX_STATUS).map(([code, v]) => ({
    value: code,
    label: v.text,
  }));

/** 报文类型 msgType（后端 gw_message_record 约定，源 `views/tx/list.vue` MSG_TYPE）。 */
export const TX_MSG_TYPE: Record<number, { text: string; variant: TxVariant }> = {
  1: { text: '报价', variant: 'secondary' },
  2: { text: '确认', variant: 'secondary' },
  3: { text: '源端验证', variant: 'secondary' },
  4: { text: '解付', variant: 'default' },
  5: { text: '冲正', variant: 'secondary' },
  8: { text: '交易事件', variant: 'outline' },
};

/** 交易状态文案；null/undefined → '-'，未知码 → `未知(${status})`（源 txStatusText）。 */
export function txStatusText(status?: number): string {
  return status == null ? '-' : (TX_STATUS[status]?.text ?? `未知(${status})`);
}

/** 交易状态 Badge variant；未知码降级 outline（源 txStatusType 的 info 兜底）。 */
export function txStatusVariant(status?: number): TxVariant {
  return status == null ? 'outline' : (TX_STATUS[status]?.variant ?? 'outline');
}

/** 报文类型文案；未知码 → `报文(${type})`（源 msgTypeText）。 */
export function txMsgTypeText(type?: number): string {
  return type == null ? '-' : (TX_MSG_TYPE[type]?.text ?? `报文(${type})`);
}

/** 报文类型 Badge variant（源 msgTypeTag 的 info 兜底）。 */
export function txMsgTypeVariant(type?: number): TxVariant {
  return type == null ? 'outline' : (TX_MSG_TYPE[type]?.variant ?? 'outline');
}

/** 本行角色文案：1 源端 / 2 目标端 / 其余 '-'（源 bankRoleText）。 */
export function txBankRoleText(role?: number): string {
  return role === 1 ? '源端' : role === 2 ? '目标端' : '-';
}

/** 本行角色 Badge variant：1 源端(primary→secondary) / 2 目标端(success→default)（源 bankRoleType）。 */
export function txBankRoleVariant(role?: number): TxVariant {
  return role === 1 ? 'secondary' : 'default';
}

/** 报文方向文案：2 出向(本→Kissen) / 其余 入向(Kissen→本)（源 direction 模板）。 */
export function txDirectionText(direction?: number): string {
  return direction === 2 ? '出向(本→Kissen)' : '入向(Kissen→本)';
}

/** 报文处理状态文案：1 处理中 / 2 成功 / 3 失败 / 其余 '-'（源 procText）。 */
export function txProcessStatusText(status?: number): string {
  return status === 1
    ? '处理中'
    : status === 2
      ? '成功'
      : status === 3
        ? '失败'
        : '-';
}

/** 报文处理状态 Badge variant：warning/success/danger/info 分层（源 procTag）。 */
export function txProcessStatusVariant(status?: number): TxVariant {
  return status === 1
    ? 'secondary'
    : status === 2
      ? 'default'
      : status === 3
        ? 'destructive'
        : 'outline';
}
