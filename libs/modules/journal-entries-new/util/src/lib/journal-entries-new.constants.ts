/**
 * Journal Entries New 共享常量与无依赖纯函数。
 *
 * 位于 `util`（最低可导入层），供 `ui` / `data-access` / `feature` 共享同一份
 * 权限码、下拉枚举与标签解析逻辑，避免循环依赖。常量值 1:1 来自源项目
 * `td-manage` 的 `src/pages/financial/journal-entries-new/index.tsx`。
 */

/**
 * 详情查看权限 UUID（TDManage 环境下用于 `userPermission` 校验）。
 * 迁移后用于 `useAuth().permissions` 的可见性判断；权限未配置（空集）时全放开，
 * 等价于源项目非 TDManage 环境（恒为 true）。
 */
export const JOURNAL_ENTRIES_PERMISSIONS = {
  Detail: 'df7766a41ce44febb121870a640d3aaa',
} as const;

/** 列表分页大小（源项目 `DEFAULT_PAGE_SIZE`）。 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * 固定 token type 下拉选项（源项目 `resolveTokenTypeLabelKey` 仅对 1/5 有文案）。
 * 与 chart-of-accounts 的 `FIXED_TOKEN_TYPES` 语义一致。
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

/** 列表 / 详情时间戳格式（date-fns Unicode token，对齐源项目 `MMM D, YYYY, HH:mm:ss`）。 */
export const JOURNAL_DATETIME_FORMAT = 'MMM d, yyyy, HH:mm:ss';

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
): `transactionType.${number}` | undefined {
  if (txType && txType >= 1 && txType <= 7) {
    return `transactionType.${txType}`;
  }
  return undefined;
}
