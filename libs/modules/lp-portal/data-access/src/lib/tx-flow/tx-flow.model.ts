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
 * 未知码显原值兜底在页面。
 */
export const TX_STATUS_LABEL: Record<number, string> = {
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
 * 交易状态 Badge 变体（源 el-tag 分层：35|40 success / 50 warning /
 * 60|80 info / 70|90 danger / 其余在途 primary）。
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
 * 交易单号展示（F1 发现：实际行 VO 字段为 txUuid，声明类型只有 txNo；
 * txUuid 优先、txNo 兜底双兜底必须保留，types 收敛留 W3 联调窗）。
 * 列表页与链路抽屉共用本实现，勿在页面各写一份分叉口径。
 */
export function txNoText(row: TxRow): string {
  const r = row as TxRow & { txUuid?: string };
  return r.txUuid || row.txNo || '-';
}
