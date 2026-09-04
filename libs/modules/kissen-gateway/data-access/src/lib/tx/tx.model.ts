/**
 * Tx 域模型（源 `types/business.ts` TxRecord/TxListReq/TxMessage/TxFlowNode/TxChain +
 * `views/tx/list.vue` 状态映射）。
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
 * senderBankName/receivingBankName/lpNames 为后端本地 join 派生（GW-14 UDPN 对齐）。
 */
export interface TxRecord {
  recordId: number;
  transactionId: number;
  /** 交易 UUID（调用方幂等键）。 */
  txUuid?: string;
  /** 交易编号（Kissen 侧业务编号，如 KSN20260814000006）。 */
  txNo?: string;
  bankRole?: number;
  pairId?: number;
  /** token 对编码（tx-event/链路同步带回，未同步时为空）。 */
  pairCode?: string;
  principal?: number;
  /** 用户实际扣减金额（源端，G-1 报价快照；fe61223 新增）。 */
  userDeduction?: number;
  /** 目标端到账金额（源行 G-1 快照 / 目标行 G-5 execute 落账；fe61223 新增）。 */
  receiverAmount?: number;
  /** 用户汇率（报价快照，源行视角；目标行未同步时为空；fe61223 新增）。 */
  userRate?: number;
  /** LP 编码（G-4 补账回填；fe61223 新增）。 */
  lpCode?: string;
  status?: number;
  /** 付款账户（用户）：源行 G-1 报价建账写入。 */
  senderAccount?: string;
  /** 收款账户：源行 G-1 / 目标行 G-4 toAccount。 */
  receiverAccount?: string;
  sourceCsTxId?: string;
  targetCsTxId?: string;
  pendingFlag?: number;
  pendingReason?: string;
  lastSyncTime?: number;
  createTime?: number;
  createUserId?: number;
  updateTime?: number;
  updateUserId?: number;
  /** 付款银行名称（pairId → token 对 sourceBankCode → gw_bank_info；对侧行不可见时为编码）。 */
  senderBankName?: string;
  /** 收款银行名称（token 对 targetBankCode 口径同上）。 */
  receivingBankName?: string;
  /** 该 token 对启用 LP 名称列表（pairId 维度口径，非交易级 lpId）。 */
  lpNames?: string[];
  /** 本行自转（源端与目标端同一银行）：单条模型下 bankRole 会被 G-4 补账覆盖，角色展示以本标记优先。 */
  selfTrade?: boolean;
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
 * Kissen 侧交易链路节点（tx_flow）：statusFrom/statusTo 对齐 TransactionStatusEnum；
 * stageStep=阶段归属（fe61223 对齐 admin 2026-09-04 六段口径：1~6，0=通用事件）。
 */
export interface TxFlowNode {
  flowId: number;
  parentFlowId: number;
  nodeType?: number;
  step?: number;
  stageStep?: number;
  statusFrom?: number;
  statusTo?: number;
  eventTime?: number;
  operator?: string;
  csTxId?: string;
  remark?: string;
  children?: TxFlowNode[];
}

/**
 * 交易阶段（fe61223 对齐 admin 2026-09-04 六段阶段轴，GW 侧由 flow 事件推导）：
 * status 1 未开始 / 2 进行中 / 3 成功 / 4 失败 / 5 跳过。当前视图未消费，仅类型对齐。
 */
export interface TxStage {
  step: number;
  stepName: string;
  status: number;
  startTime: number;
  endTime: number;
  operator: string;
  csTxId: string;
  remark: string;
}

/** 交易链路（GET /tx/chain/{id}）：本地报文 + Kissen 状态迁移链 + 六段阶段轴。 */
export interface TxChain {
  localMessages: TxMessage[];
  kissenChain: TxFlowNode[] | null;
  /** fe61223 新增；当前视图未消费，仅类型对齐。 */
  stages?: TxStage[];
}

/**
 * 交易状态（对齐后端 TransactionStatusEnum，源 `views/tx/list.vue` TX_STATUS）。
 * variant 分层映射：Element info→outline、primary/warning→secondary、success→default、danger→destructive。
 */
export const TX_STATUS: Record<number, { text: string; variant: TxVariant }> = {
  1: { text: 'Created', variant: 'outline' },
  5: { text: 'Quoted', variant: 'secondary' },
  10: { text: 'Confirmed', variant: 'secondary' },
  20: { text: 'Source Transfer in Progress', variant: 'secondary' },
  25: { text: 'Source Arrival Verified', variant: 'secondary' },
  30: { text: 'Disbursing', variant: 'secondary' },
  /* fe61223：2026-09-02 起成功终态停 35，对外文案与 40 统一为 Completed。 */
  35: { text: 'Completed', variant: 'default' },
  40: { text: 'Completed', variant: 'default' },
  50: { text: 'Reversing', variant: 'secondary' },
  60: { text: 'Reversed', variant: 'outline' },
  70: { text: 'Error (Manual Handling)', variant: 'destructive' },
  80: { text: 'Cancelled', variant: 'outline' },
  90: { text: 'Failed', variant: 'destructive' },
};

/** 状态筛选下拉选项（全 13 值；value 为字符串供 Select 使用）。 */
export const TX_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  Object.entries(TX_STATUS).map(([code, v]) => ({
    value: code,
    label: v.text,
  }));

/** 报文类型 msgType（后端 gw_message_record 约定，源 `views/tx/list.vue` MSG_TYPE）。 */
export const TX_MSG_TYPE: Record<number, { text: string; variant: TxVariant }> = {
  1: { text: 'Quote', variant: 'secondary' },
  2: { text: 'Confirmation', variant: 'secondary' },
  3: { text: 'Source Verification', variant: 'secondary' },
  4: { text: 'Disbursement', variant: 'default' },
  5: { text: 'Reversal', variant: 'secondary' },
  8: { text: 'Transaction Event', variant: 'outline' },
};

/**
 * 六段阶段事件业务标题（fe61223 对齐 admin 2026-09-04 链路展示口径，源
 * `views/tx/list.vue` STAGE_EVENT_TITLE）：stageStep 1~6 每段一个业务动作名。
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
 * 链路节点事件标题（源 eventTitle）：阶段事件（stageStep 1~6）用业务动作名；
 * 通用/分支事件（stageStep=0/缺省）回退迁移后状态文案。
 */
export function txFlowEventTitle(node: {
  stageStep?: number;
  statusTo?: number;
}): string {
  return TX_STAGE_EVENT_TITLE[node.stageStep ?? 0] ?? txStatusText(node.statusTo);
}

/** 交易状态文案；null/undefined → '-'，未知码 → `未知(${status})`（源 txStatusText）。 */
export function txStatusText(status?: number): string {
  return status == null ? '-' : (TX_STATUS[status]?.text ?? `Unknown (${status})`);
}

/** 交易状态 Badge variant；未知码降级 outline（源 txStatusType 的 info 兜底）。 */
export function txStatusVariant(status?: number): TxVariant {
  return status == null ? 'outline' : (TX_STATUS[status]?.variant ?? 'outline');
}

/** 报文类型文案；未知码 → `报文(${type})`（源 msgTypeText）。 */
export function txMsgTypeText(type?: number): string {
  return type == null ? '-' : (TX_MSG_TYPE[type]?.text ?? `Message (${type})`);
}

/** 报文类型 Badge variant（源 msgTypeTag 的 info 兜底）。 */
export function txMsgTypeVariant(type?: number): TxVariant {
  return type == null ? 'outline' : (TX_MSG_TYPE[type]?.variant ?? 'outline');
}

/** 本行角色文案：1 源端 / 2 目标端 / 其余 '-'（源 bankRoleText）。 */
export function txBankRoleText(role?: number): string {
  return role === 1 ? 'Source' : role === 2 ? 'Target' : '-';
}

/** 本行角色 Badge variant：1 源端(primary→secondary) / 2 目标端(success→default)（源 bankRoleType）。 */
export function txBankRoleVariant(role?: number): TxVariant {
  return role === 1 ? 'secondary' : 'default';
}

/** 报文方向文案：2 出向(本→Kissen) / 其余 入向(Kissen→本)（源 direction 模板）。 */
export function txDirectionText(direction?: number): string {
  return direction === 2 ? 'Outbound (Bank → Kissen)' : 'Inbound (Kissen → Bank)';
}

/** 报文处理状态文案：1 处理中 / 2 成功 / 3 失败 / 其余 '-'（源 procText）。 */
export function txProcessStatusText(status?: number): string {
  return status === 1
    ? 'Processing'
    : status === 2
      ? 'Success'
      : status === 3
        ? 'Failed'
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
