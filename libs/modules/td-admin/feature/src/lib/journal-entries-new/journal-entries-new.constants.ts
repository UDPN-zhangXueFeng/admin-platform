/**
 * Journal Entries New 共享常量与无依赖纯函数。
 *
 * 常量值 1:1 来自源项目
 * `td-manage` 的 `src/pages/financial/journal-entries-new/index.tsx`。
 */

/** 后端 UUID，仅用于 TDManage 环境下详情行操作的可见性。 */
export const JOURNAL_ENTRIES_PERMISSIONS = {
  Detail: 'df7766a41ce44febb121870a640d3aaa',
} as const;

/** This admin defaults to TDManage unless the deployment explicitly sets a different mode. */
export function canViewJournalDetails(environment: string | undefined, permissions: ReadonlySet<string>): boolean {
  return (environment ?? 'TDManage') !== 'TDManage' || permissions.has(JOURNAL_ENTRIES_PERMISSIONS.Detail);
}

/** 列表分页大小（源项目 `DEFAULT_PAGE_SIZE`）。 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Token Type 过滤范围及已知列表标签；选项名称和状态始终从接口读取。
 */
export const FIXED_TOKEN_TYPES = [1, 5] as const;

/** 有文案的 token type（用于列单元格标签解析）。 */
export type JournalTokenType = 1 | 5;

/**
 * 交易类型下拉枚举（源项目 `TRANSACTION_TYPE_VALUES`）。
 * 注意：源项目列单元格仅解析 1–7 的文案，其余兜底 '--'（见 {@link resolveTxTypeMessageKey}）。
 */
export const TRANSACTION_TYPE_VALUES = [
  1, 2, 3, 4, 5, 6, 9, 10, 12, 13, 16, 17, 18,
] as const;

/** “全部”占位值（Radix Select 不允许空字符串 value，故用 `'all'`）。 */
export const ALL_VALUE = 'all';

/**
 * 文本字段规范化：去首尾空格，空串视为未填写（返回 `undefined`），
 * 避免向后端提交空字符串触发误筛选。
 */
export function normalizeTextValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * 解析 token type → 模块 i18n message key（相对 `modules.journal-entries-new` 命名空间）。
 * 仅 1 / 5 有文案，其余返回 `undefined`（调用方兜底 '--'）。
 */
export function resolveTokenTypeMessageKey(
  tokenType?: number | null
): `tokenType.${1 | 5}` | undefined {
  if (tokenType === 1 || tokenType === 5) {
    return `tokenType.${tokenType}`;
  }
  return undefined;
}

/**
 * 解析交易类型 → 模块 i18n message key（相对命名空间）。
 * 1:1 还原源项目 `resolveTxTypeLabelKey`：仅 1–7 解析，其余返回 `undefined`（兜底 '--'）。
 */
export function resolveTxTypeMessageKey(
  txType?: number | null
): `transactionType.${1 | 2 | 3 | 4 | 5 | 6 | 7}` | undefined {
  if (txType === 1 || txType === 2 || txType === 3 || txType === 4 || txType === 5 || txType === 6 || txType === 7) {
    return `transactionType.${txType}`;
  }
  return undefined;
}
