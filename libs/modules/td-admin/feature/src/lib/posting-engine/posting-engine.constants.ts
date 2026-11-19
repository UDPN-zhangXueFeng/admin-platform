/**
 * Posting Engine 模块常量与纯函数 helpers。
 *
 * 迁移自 td-manage `src/pages/financial/posting-engine`（index / edit / view / detail）。
 * 全部为纯函数，便于单测（jest 仅在 util 层可行，见记忆「验证硬限制」）。
 */

// ── 基础常量 ──────────────────────────────────────────────────────────────────

/** 筛选下拉「全部」占位值（与 chart-of-accounts / journal-entries-new 一致）。 */
export const ALL_VALUE = 'all';

/** 列表默认每页条数。 */
export const DEFAULT_PAGE_SIZE = 10;

/** 空值占位展示。 */
export const EMPTY_DISPLAY = '--';

/** When a mapping omits its expression, the legacy rule uses the transaction amount. */
export const DEFAULT_AMOUNT_EXPRESSION = 'Transaction Amount';

/** Posting Engine 支持的 tokenType（1=Stablecoin，5=Tokenized Deposit）。 */
export const FIXED_TOKEN_TYPES = [1, 5] as const;

/** 借贷方向：源项目 direction 字段（1=Debit，2=Credit）。 */
export const DIRECTION = {
  Debit: 1,
  Credit: 2,
} as const;

/** 映射方式：1=DIRECT，2=CONSTANT（源项目 mappingMethod 字段）。 */
export const MAPPING_METHOD = {
  Direct: 1,
  Constant: 2,
} as const;

/**
 * eventType → sourceEventType 文本键映射（迁移自 edit.tsx EVENT_TYPE_SOURCE_EVENT_MAP）。
 */
export const EVENT_TYPE_SOURCE_EVENT_MAP: Record<number, string> = {
  1: 'reserveIn',
  3: 'fundingIn',
  5: 'mint',
  10: 'repositoryOut',
  15: 'transfer',
  20: 'repositoryIn',
  25: 'melt',
  30: 'reserveOut',
  35: 'fundingOut',
};

/** Row-action grants from td-manage; separate from menu access. */
export const POSTING_ENGINE_PERMISSIONS = {
  MappingRules: 'cb15dddd13a54a27b50917f17d301362',
  Details: '1ceca88b72224410bb0db06b4d545d7b',
} as const;

export const POSTING_ENGINE_PATH = '/accounting/posting-engine';

export function parsePostingId(raw?: string | null): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

// ── 状态码 ──────────────────────────────────────────────────────────────────

/** 已知状态码（迁移自 view.tsx / PostingEngineMatrixTab 的状态码集合）。 */
export const POSTING_STATUS = {
  LegacyActive: 1,
  Pending: 5,
  UnderApproval: 10,
  Rejected: 15,
  Configured: 25,
  Scheduled: 30,
  Active: 20,
  Effective: 35,
  Expired: 45,
} as const;

/** badge 色调（语义化，由页面映射 Tailwind class，解耦具体 Badge 组件 API）。 */
export type PostingStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'default';

interface PostingStatusMeta {
  labelKey?: string;
  tone: PostingStatusTone;
}

export function resolvePostingStatusMeta(
  status?: number,
  statusName?: string,
  scope: 'book' | 'matrix' | 'event' = 'event'
): PostingStatusMeta {
  const code = Number(status);
  if (scope !== 'book') {
    switch (code) {
      case POSTING_STATUS.Pending:
        return { labelKey: 'status.pending', tone: 'warning' };
      case POSTING_STATUS.UnderApproval:
        return { labelKey: 'status.underApproval', tone: 'warning' };
      case POSTING_STATUS.Rejected:
        return { labelKey: 'status.rejected', tone: 'danger' };
      case POSTING_STATUS.Configured:
        return { labelKey: scope === 'matrix' ? 'status.configured' : 'status.scheduled', tone: 'info' };
      case POSTING_STATUS.Scheduled:
        if (scope === 'event') return { labelKey: 'status.scheduled', tone: 'info' };
        break;
      case POSTING_STATUS.Effective:
        return { labelKey: 'status.active', tone: 'success' };
      case POSTING_STATUS.Expired:
        return { labelKey: 'status.expired', tone: 'default' };
    }
  }
  if (code === POSTING_STATUS.LegacyActive || code === POSTING_STATUS.Active || statusName?.toLowerCase() === 'active') {
    return { labelKey: 'status.active', tone: 'success' };
  }
  if (scope === 'book' && (code === 0 || code === 30)) {
    return { labelKey: 'status.inactive', tone: 'default' };
  }
  return { tone: 'default' };
}

/** 色调 → Tailwind class（border + bg + text，呼应源项目 Tag 配色）。 */
export function postingStatusToneClass(tone: PostingStatusTone): string {
  switch (tone) {
    case 'success':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'warning':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'danger':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'info':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

// ── 展示 helpers ─────────────────────────────────────────────────────────────

/** 时间戳归一：秒 → 毫秒（< 1e12 视为秒）。迁移自源项目 `v >= 1e12 ? v : v * 1000`。 */
export function toMillis(value?: number | string | null): number | undefined {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return timestamp >= 1e12 ? timestamp : timestamp * 1000;
}

/** 解析借贷方向串（换行 / 分号分隔）。迁移自 entryDirectionUtils.splitEntryDirection。 */
export function splitEntryDirection(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|;\s*/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/** tokenType → 模块命名空间 i18n key（'tokenType.1' / 'tokenType.5'）。 */
export function resolveTokenTypeMessageKey(
  tokenType?: number
): string | undefined {
  if (tokenType === undefined || tokenType === null) return undefined;
  return FIXED_TOKEN_TYPES.some((type) => type === Number(tokenType))
    ? `tokenType.${tokenType}`
    : undefined;
}

export function getSourceEventTypeMessageKey(
  eventType?: number | string,
  tokenType?: number
): string | undefined {
  if (eventType === undefined || eventType === null) return undefined;
  const code = Number(eventType);
  if (Number(tokenType) === 5 && code === 1) return 'sourceEvent.fundingIn';
  if (Number(tokenType) === 5 && code === 30) return 'sourceEvent.fundingOut';
  const key = EVENT_TYPE_SOURCE_EVENT_MAP[code] ?? Object.values(EVENT_TYPE_SOURCE_EVENT_MAP).find(
    (value) => value.toLowerCase() === String(eventType).replaceAll('_', '').toLowerCase()
  );
  if (Number(tokenType) === 5 && key === 'reserveIn') return 'sourceEvent.fundingIn';
  if (Number(tokenType) === 5 && key === 'reserveOut') return 'sourceEvent.fundingOut';
  return key ? `sourceEvent.${key}` : undefined;
}

export function paginationRange(page: number, total: number) {
  return {
    from: total ? (page - 1) * DEFAULT_PAGE_SIZE + 1 : 0,
    to: Math.min(page * DEFAULT_PAGE_SIZE, total),
    total,
  };
}

/** direction → 'Dr' | 'Cr' | ''（1=Dr，2=Cr）。 */
export function directionLabel(direction?: number): 'Dr' | 'Cr' | '' {
  if (direction === DIRECTION.Credit) return 'Cr';
  if (direction === DIRECTION.Debit) return 'Dr';
  return '';
}

/** mappingMethod → i18n key（'mappingMethod.direct' / 'mappingMethod.constant'）。 */
export function mappingMethodMessageKey(
  method?: number
): string | undefined {
  if (method === MAPPING_METHOD.Direct) return 'mappingMethod.direct';
  if (method === MAPPING_METHOD.Constant) return 'mappingMethod.constant';
  return undefined;
}

/**
 * 编辑页账户下拉 label 格式："code - name"。
 *
 * 源项目 Select 选项 label 为 `${accountCode} - ${accountName}`，保存时反向解析。
 */
export function formatAccountLabel(code?: string, name?: string): string {
  if (!code && !name) return '';
  if (!code) return name ?? '';
  if (!name) return code;
  return `${code} - ${name}`;
}
