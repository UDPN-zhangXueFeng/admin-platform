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

/**
 * Posting Engine 权限键。
 *
 * NOTE: 源项目在 TDManage 环境用 localStorage 中的 UUID 做操作门控。真实 UUID 待从
 * td-manage 权限配置确认后补全（见记忆「auth 验证限制」），当前以语义化键占位，
 * 权限为空集时页面全放开（等价源项目非 TDManage 环境）。
 */
export const POSTING_ENGINE_PERMISSIONS = {
  Detail: 'posting-engine:detail',
  Edit: 'posting-engine:edit',
} as const;

// ── 状态码 ──────────────────────────────────────────────────────────────────

/** 已知状态码（迁移自 view.tsx / PostingEngineMatrixTab 的状态码集合）。 */
export const POSTING_STATUS = {
  LegacyActive: 1,
  Pending: 5,
  PendingReview: 10,
  Rejected: 15,
  Submitted: 25,
  InReview: 30,
  Active: 20,
  Approved: 35,
  Disabled: 45,
} as const;

/** badge 色调（语义化，由页面映射 Tailwind class，解耦具体 Badge 组件 API）。 */
export type PostingStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'default';

export interface PostingStatusMeta {
  /** 模块命名空间 i18n key（如 'status.approved'）。 */
  labelKey: string;
  /** badge 色调。 */
  tone: PostingStatusTone;
  /** 是否为激活态（列表 active 判定用）。 */
  isActive: boolean;
}

/**
 * 解析状态码 → 展示元信息（迁移自 view.tsx getStatusMeta / BasicInformationTab isActive）。
 *
 * 明细码：5/10 橙、15 红、25/30 蓝、35 绿、45 灰；
 * legacy/Basic：1/20 或 statusName='active' → 绿；其余 → 灰 + inactive。
 */
export function resolvePostingStatusMeta(
  status?: number,
  statusName?: string
): PostingStatusMeta {
  const isStatusNameActive =
    typeof statusName === 'string' && statusName.toLowerCase() === 'active';

  switch (status) {
    case POSTING_STATUS.Pending:
      return { labelKey: 'status.draft', tone: 'warning', isActive: false };
    case POSTING_STATUS.PendingReview:
      return {
        labelKey: 'status.pendingReview',
        tone: 'warning',
        isActive: false,
      };
    case POSTING_STATUS.Rejected:
      return { labelKey: 'status.rejected', tone: 'danger', isActive: false };
    case POSTING_STATUS.Submitted:
      return { labelKey: 'status.submitted', tone: 'info', isActive: false };
    case POSTING_STATUS.InReview:
      return { labelKey: 'status.inReview', tone: 'info', isActive: false };
    case POSTING_STATUS.Approved:
      return { labelKey: 'status.approved', tone: 'success', isActive: true };
    case POSTING_STATUS.Disabled:
      return { labelKey: 'status.disabled', tone: 'default', isActive: false };
    default:
      break;
  }

  if (status === POSTING_STATUS.LegacyActive || status === POSTING_STATUS.Active || isStatusNameActive) {
    return { labelKey: 'status.active', tone: 'success', isActive: true };
  }
  return { labelKey: 'status.inactive', tone: 'default', isActive: false };
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
export function toMillis(value?: number | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  return value >= 1e12 ? value : value * 1000;
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
  return `tokenType.${tokenType}`;
}

/** eventType → sourceEventType i18n key（'sourceEvent.mint' 等）。 */
export function getSourceEventTypeMessageKey(
  eventType?: number
): string | undefined {
  if (eventType === undefined || eventType === null) return undefined;
  const key = EVENT_TYPE_SOURCE_EVENT_MAP[eventType];
  return key ? `sourceEvent.${key}` : undefined;
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

/** 从 "code - name" label 反向解析（保存 payload 用）。 */
export function parseAccountLabel(label: string): {
  accountCode: string;
  accountName: string;
} {
  const trimmed = label.trim();
  const idx = trimmed.indexOf(' - ');
  if (idx === -1) {
    return { accountCode: trimmed, accountName: trimmed };
  }
  return {
    accountCode: trimmed.slice(0, idx).trim(),
    accountName: trimmed.slice(idx + 3).trim(),
  };
}
