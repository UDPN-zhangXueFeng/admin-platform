/**
 * 铸销记录表共享常量与工具（从 tab-records.tsx 拆出）。
 *
 * 源: tab-records.tsx 62-101（DATETIME_FMT / NUMBER_LOCALE / APPROVAL_VIEW_ROUTE +
 * formatAmount（reSet 等价实现）+ buildTxBrowserHref（区块链浏览器 tx 链接））。
 * pledge-records-table.tsx 与 sp-records-table.tsx 共用，避免重复声明。
 */
import { reSet } from '../re-set';

/** 时间戳格式（对齐源 formatTimestamp → 'YYYY-MM-DD HH:mm:ss'）。 */
export const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 审批详情路由（跨模块跳转，源 pathname '/approval-manage/view'）。 */
export const APPROVAL_VIEW_ROUTE = '/approval-manage/view';

/**
 * 安全数值格式化——直接代理模块级 `reSet`（源 libs/utils 变体逐分支等价：
 * undefined/负数→'--'，四舍五入 2 位小数 + 千分位）。
 * 与 overview-info-card 的 formatStat 同语义（同一 reSet，单一事实来源）。
 */
export function formatAmount(value: number | string | undefined | null): string {
  return reSet(value);
}

/**
 * 构造区块链浏览器 tx 链接（对齐源 getTxBrowserHref）。
 *
 * browserUrl 末尾补 '/'（若无）后拼 'tx/{txHash}'；browserUrl / txHash 缺失返回空串。
 */
export function buildTxBrowserHref(
  browserUrl?: string,
  txHash?: string,
): string {
  if (!browserUrl || !txHash) return '';
  const normalized = browserUrl.endsWith('/')
    ? browserUrl
    : `${browserUrl}/`;
  return `${normalized}tx/${txHash}`;
}
