/**
 * Kissen 跨行转账（cross-bank transfer）数据模型。
 *
 * 类型来源：td-manage `pages/transaction-flow/kissen-transfer/{index,view}.tsx`，
 * 字段口径对齐 gateway TxRecord / TxFlowNode。
 *
 * 列表行注入字符串 `id`（= String(transactionId)）满足 DataTable `{ id: string }` 契约。
 */

export interface ResultPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

/** 列表筛选条件（POST /kissen/transfer/listPage 的 `data`）。全部可选。 */
export interface KissenTransferFilters {
  txNo?: string;
  pairId?: number;
  senderAccount?: string;
  receiverAccount?: string;
  lpName?: string;
  status?: number;
  /** 创建时间下界（毫秒时间戳）。 */
  startTime?: number;
  /** 创建时间上界（毫秒时间戳）。 */
  endTime?: number;
}

export interface KissenTransferListParams {
  pageNum: number;
  pageSize: number;
  filters: KissenTransferFilters;
}

/** 列表行（字段口径对齐 gateway TxRecord）。 */
export interface KissenTransferRow {
  /** DataTable 契约 id（= String(transactionId)）。 */
  id: string;
  transactionId: number;
  txNo?: string;
  txUuid?: string;
  pairId?: number;
  sourceTokenSymbol?: string;
  targetTokenSymbol?: string;
  sourceBankCode?: string;
  targetBankCode?: string;
  userDeduction?: number;
  receiverAmount?: number;
  userRate?: number;
  status?: number;
  senderAccount?: string;
  receiverAccount?: string;
  senderBankName?: string;
  receivingBankName?: string;
  pendingFlag?: boolean | number;
  selfTrade?: boolean | number;
  sourceCsTxId?: string;
  targetCsTxId?: string;
  createTime?: number;
}

export interface KissenTransferListResponse {
  page?: ResultPageInfo;
  rows: KissenTransferRow[];
}

/** 链路节点（阶段事件）：字段对齐 gateway TxFlowNode。 */
export interface KissenTransferStage {
  flowId?: number;
  parentFlowId?: number;
  nodeType?: number;
  step?: number;
  /** 阶段归属 1~6；0 = 通用事件。 */
  stageStep?: number;
  statusFrom?: number;
  statusTo?: number;
  eventTime?: number;
  operator?: string;
  csTxId?: string;
  remark?: string;
}

/** 详情响应：字段对齐 gateway TxRecord；chain 仅 includeChain=true 时返回。 */
export interface KissenTransferDetail
  extends Omit<KissenTransferRow, 'id' | 'transactionId'> {
  transactionId?: number;
  found?: boolean;
  principal?: number;
  pendingReason?: string;
  failReason?: string;
  lpCode?: string;
  lpNames?: string[];
  lastSyncTime?: number;
  chain?: {
    kissenChain?: KissenTransferStage[] | null;
  } | null;
}

/** 详情请求参数（transactionId 必传，其余查询条件空值不下发）。 */
export interface KissenTransferDetailParams {
  transactionId: number;
  includeChain: boolean;
  txUuid?: string;
  sourceCsTxId?: string;
  targetCsTxId?: string;
}
