/**
 * LP Portal 交易流水域模型（源 `src/types/business.ts` TxRow/TxChainNode/
 * TxListReq + `src/views/tx-flow/index.vue` TX_STATUS_MAP/txStatusTagType）。
 *
 * 端点：
 * - POST /lp/tx-flow/list（分页；lpId 由 BFF 登录域注入不传，chain 归属
 *   校验在 BFF/api 侧）
 * - GET /lp/tx-flow/chain/{transactionId}
 * - POST /lp/pair/list（货币对选项，非主数据）
 */
import type { TxChainNode, TxListReq, TxRow } from '../types';

/** 行/链路节点/筛选体沿用公共源类型（Vue types/business.ts 全量平移）。 */
export type { TxChainNode, TxListReq, TxRow };

/** 列表请求（query hook 入参；filter 序列化进 `data` 包）。 */
export interface TxFlowListReq {
  pageNum: number;
  pageSize: number;
  filter: TxListReq;
}

/**
 * 交易状态文案（源 TransactionStatusEnum 13 值，TX_STATUS_MAP）。
 * 2026-09-04 aad34fa：35 即成功终态「已完成」（原「已入账/Credited」），
 * 40 仅历史数据同文案。未知码显原值兜底在页面。
 */
export const TX_STATUS_LABEL: Record<number, string> = {
  1: 'Created',
  5: 'Quoted',
  10: 'Confirmed',
  20: 'Source Transferring',
  25: 'Source Verified',
  30: 'Disbursing',
  35: 'Completed',
  40: 'Completed',
  50: 'Reversing',
  60: 'Reversed',
  70: 'Abnormal',
  80: 'Cancelled',
  90: 'Failed',
};

/**
 * 交易状态 Badge 变体（源 el-tag 分层：**35|40 success（2026-09-04 起
 * 列表口径亦然，原 35 列表 primary 已升格）** / 50 warning / 60|80 info /
 * 70|90 danger / 其余在途 primary）。
 *
 * Badge 无 success/warning/info 变体，按视觉语义映射并沿用 topup/rate 先例：
 * success→default（实底强调，topup 先例 success→default）、warning→outline
 * +警示 amber 描边（{@link TX_STATUS_WARN_CLASS}，50 冲正中独有的警示色，
 * 不与 destructive 混淆）、info→outline（中性描边）、danger→destructive、
 * 在途 primary→secondary（topup 先例 primary→secondary）。
 */
export const TX_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  35: 'default',
  40: 'default',
  50: 'outline',
  60: 'outline',
  80: 'outline',
  70: 'destructive',
  90: 'destructive',
};

/** 50 冲正中（warning 层）的警示描边类，渲染层叠加在 outline 变体上。 */
export const TX_STATUS_WARN_CLASS =
  'border-amber-300 bg-amber-50 text-amber-900';

/**
 * 交易单号展示（v2.3 e591f85 固定口径：全网唯一 KSN 单号 `txNo || '-'`，
 * 不再回退 txUuid/transactionId；txUuid 移作抽屉「Bank Idempotency No.」
 * 独立项）。列表页、链路抽屉、split 明细、settle 流水共用本口径，勿在
 * 页面各写一份分叉实现。
 */
export function txNoText(row: Pick<TxRow, 'txNo'>): string {
  return row.txNo || '-';
}
