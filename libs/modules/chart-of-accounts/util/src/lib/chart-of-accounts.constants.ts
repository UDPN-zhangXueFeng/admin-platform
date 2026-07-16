/**
 * Chart of Accounts 共享常量与无依赖纯函数。
 *
 * 位于 `util`（最低可导入层），供 `ui` / `data-access` / `feature` 共享同一份
 * 权限码与规范化逻辑，避免循环依赖。常量值 1:1 来自源项目
 * `td-manage` 的 `src/pages/financial/chart-of-accounts/index.tsx`。
 */

/**
 * 操作菜单权限 UUID（TDManage 环境下用于 `userPermission` 校验）。
 * 迁移后用于 `usePermission` / 操作项可见性判断。
 */
export const CHART_OF_ACCOUNTS_PERMISSIONS = {
  Detail: 'e37d960ebaaa45d5a8b07c2008ad4a46',
  Edit: '83ce166e92e04a7aa9a12083a8c50f60',
  ViewStatements: 'a3c908d0ec994da6abf82eea3872196f',
} as const;

/** 固定 token type 下拉选项（源项目 `FIXED_TOKEN_TYPES`）。 */
export const FIXED_TOKEN_TYPES = [1, 5] as const;

/** 默认分页大小。 */
export const DEFAULT_PAGE_SIZE = 10;

/** 默认 active 状态码（20/30 体系）。 */
export const DEFAULT_ACTIVE_STATUS_CODE = 20;

/** 默认 inactive 状态码（20/30 体系）。 */
export const DEFAULT_INACTIVE_STATUS_CODE = 30;

/** 货币码校验：2-12 位字母 / 数字 / 下划线 / 连字符。 */
export const CURRENCY_CODE_REGEX = /^[A-Za-z0-9_-]{2,12}$/;

/** 表单层状态筛选语义值。 */
export type ChartOfAccountsStatusFilter = 'active' | 'inactive';

/**
 * 文本字段规范化：去首尾空格，空串视为未填写（返回 `undefined`），
 * 避免向后端提交空字符串触发误筛选。
 */
export function normalizeTextValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * 货币码规范化：去空格 → 校验格式 → 转大写。
 * 非字符串 / 空串 / 不合法均返回 `undefined`（保留源项目回退去重逻辑）。
 */
export function normalizeCurrencyCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (!CURRENCY_CODE_REGEX.test(normalized)) {
    return undefined;
  }

  return normalized.toUpperCase();
}

/**
 * 把表单状态筛选（active/inactive）解析为后端状态码。
 * 状态码由列表数据自适应推断（见 feature 层 `useStatusCodes`），
 * 因此这里只做纯映射，不写死 20/30，保证多环境兼容。
 */
export function resolveStatusCode(
  value: ChartOfAccountsStatusFilter | '' | undefined,
  activeStatusCode: number,
  inactiveStatusCode: number
): number | undefined {
  if (value === 'active') {
    return activeStatusCode;
  }

  if (value === 'inactive') {
    return inactiveStatusCode;
  }

  return undefined;
}

/**
 * 自适应状态码推断（源项目核心逻辑，文档 §8 风险点）。
 *
 * 根据当前页返回的 status 值集合判断环境使用 20/30 还是 1/0 体系，
 * 避免写死导致其他环境筛选 / 渲染异常；无数据时回退默认 20/30。
 *
 * 接收结构类型 `{ status?: number | null }` 而非 data-access 的实体类型，
 * 避免 `util` → `data-access` 循环依赖，同时保持可单测。
 */
export function resolveStatusCodes(
  rows: ReadonlyArray<{ status?: number | null }>
): { active: number; inactive: number } {
  const codes = new Set(
    rows
      .map((item) => item.status)
      .filter((item): item is number => item !== undefined && item !== null)
  );

  return {
    active: codes.has(20) ? 20 : codes.has(1) ? 1 : DEFAULT_ACTIVE_STATUS_CODE,
    inactive: codes.has(30)
      ? 30
      : codes.has(0)
        ? 0
        : DEFAULT_INACTIVE_STATUS_CODE,
  };
}

/** active 状态码集合（兼容 20/30 与 1/0 体系，供 resolveCoaStatus 等共享）。 */
export const ACTIVE_STATUS_CODES = new Set([1, 20]);

/** inactive 状态码集合。 */
export const INACTIVE_STATUS_CODES = new Set([0, 30]);
