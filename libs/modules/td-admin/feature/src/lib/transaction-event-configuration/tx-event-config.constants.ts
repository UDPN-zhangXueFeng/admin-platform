/**
 * Transaction Event Configuration 模块常量与纯函数 helpers。
 *
 * 迁移自 td-manage：
 * - `src/lib/components/financial/transaction-event-configuration/mock.ts` 的类型与常量部分
 *   （MOCK_DATA 即 STABLECOIN/TOKENIZED 记录未被源页面使用，故不迁移）
 * - `pages/financial/transaction-event-configuration`（index / mapping-rule index / detail /
 *   edit）的纯函数逻辑（状态码自适应、时间格式化、映射行判定、payload 构建 helpers）
 *
 * 全部为纯函数，便于单测（jest 仅 util 层可行，见记忆「验证硬限制」）。
 */

import { format } from 'date-fns';

// ── 基础常量 ──────────────────────────────────────────────────────────────────

/** 筛选下拉「全部」占位值（与 chart-of-accounts / journal-entries-new / posting-engine 一致）。 */
export const ALL_VALUE = 'all';

/** 列表默认每页条数。 */
export const DEFAULT_PAGE_SIZE = 10;

/** 空值占位展示。 */
export const EMPTY_DISPLAY = '--';

/** 表单/表格内空字段展示（迁移自 edit.tsx EMPTY_FIELD_VALUE）。 */
export const EMPTY_FIELD_VALUE = '--';

/** 支持的 tokenType（1=Stablecoin，5=Tokenized Deposit）。 */
export const FIXED_TOKEN_TYPES = [1, 5] as const;

// ── 类型（迁移自 mock.ts）─────────────────────────────────────────────────────

export type SourceEventTypeKey =
  | 'reserveIn'
  | 'mint'
  | 'repositoryOut'
  | 'transfer'
  | 'repositoryIn'
  | 'melt'
  | 'reserveOut'
  | 'fundingIn'
  | 'fundingOut';

export type MappingMethod = 'DIRECT' | 'CONSTANT' | 'GENERATE';

export type MappingFieldKey =
  | 'UniversalTransactionIdentifier'
  | 'UserUniversalIdentifier'
  | 'TokenName'
  | 'TransactionDate'
  | 'ValueDate'
  | 'FinalityDate'
  | 'OrganizationCode'
  | 'TokenType'
  | 'Blockchain'
  | 'From'
  | 'To'
  | 'TransactionAmount'
  | 'TransactionHash'
  | 'TransactionTime'
  | 'Status';

export type MappingOptionalFieldKey = Extract<
  MappingFieldKey,
  | 'TokenType'
  | 'Blockchain'
  | 'From'
  | 'To'
  | 'TransactionAmount'
  | 'TransactionHash'
  | 'TransactionTime'
  | 'Status'
>;

/** Mapping Rule 列表行状态（迁移自 mock.ts MappingRuleListStatus）。 */
export type MappingRuleListStatus = 'active' | 'pendingActivation' | 'expired';

/** Normalization Book 列表行状态。 */
export type BookListStatus = 'active' | 'inactive' | 'unknown';

// ── 字段顺序常量 ──────────────────────────────────────────────────────────────

/** 固定（系统内置）映射字段顺序（迁移自 FIXED_FIELD_ORDER）。 */
export const FIXED_FIELD_ORDER: MappingFieldKey[] = [
  'UniversalTransactionIdentifier',
  'UserUniversalIdentifier',
  'TokenName',
  'TransactionDate',
  'ValueDate',
  'OrganizationCode',
];

/** 可选映射字段顺序（迁移自 OPTIONAL_FIELD_ORDER）。 */
export const OPTIONAL_FIELD_ORDER: MappingOptionalFieldKey[] = [
  'TokenType',
  'Blockchain',
  'From',
  'To',
  'TransactionAmount',
  'TransactionHash',
  'TransactionTime',
  'Status',
];

export const FIXED_FIELD_KEY_SET = new Set<string>(FIXED_FIELD_ORDER);

/** OrganizationCode 是唯一可编辑的固定行（CONSTANT，值来自 organizationCode 字段）。 */
export const ORGANIZATION_CODE_FIELD: MappingFieldKey = 'OrganizationCode';

// ── 映射方法 ──────────────────────────────────────────────────────────────────

/** 映射方法：1=DIRECT，2=CONSTANT，3=GENERATE（源 mappingMethod 字段）。 */
export const MAPPING_METHOD_VALUE: Record<MappingMethod, number> = {
  DIRECT: 1,
  CONSTANT: 2,
  GENERATE: 3,
};

export const MAPPING_METHOD_LABEL: Record<number, MappingMethod> = {
  1: 'DIRECT',
  2: 'CONSTANT',
  3: 'GENERATE',
};

/** eventType → sourceEventType 文本键（迁移自 EVENT_TYPE_SOURCE_EVENT_MAP）。 */
export const EVENT_TYPE_SOURCE_EVENT_MAP: Record<number, SourceEventTypeKey> = {
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

/** TD 账本 bookId（源 getFinancialBookMetaById 用其区分 stablecoin / td 文案）。 */
export const TD_BOOK_ID = '2';

// ── 权限 ──────────────────────────────────────────────────────────────────────

/**
 * 权限键（语义化占位）。源项目在 TDManage 环境用 localStorage UUID（MAPPING_RULES_PERMISSION
 * ='91ce483ff5fe47fc94073cdc25256935'）做门控；真实 UUID 待确认，当前权限空集时页面全放开。
 */
export const TX_EVENT_CONFIG_PERMISSIONS = {
  ViewMappingRules: 'transaction-event-configuration:view-mapping-rules',
} as const;

// ── 状态码自适应 ──────────────────────────────────────────────────────────────

/** badge 色调（语义化，由页面映射 Tailwind class）。 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'default';

/** Normalization Book 列表行状态推断（迁移自 index.tsx status 渲染逻辑）。 */
export function resolveBookListStatus(
  status?: number,
  statusName?: string
): BookListStatus {
  const lower = (statusName ?? '').trim().toLowerCase();
  if (status === 1 || lower === 'active') return 'active';
  if (
    status === 0 ||
    status === 2 ||
    lower === 'inactive' ||
    lower === 'in-active'
  ) {
    return 'inactive';
  }
  return 'unknown';
}

/** Normalization Book 列表状态 → i18n key + tone。 */
export function resolveBookListStatusMeta(
  status?: number,
  statusName?: string
): { labelKey: string; tone: StatusTone } {
  const resolved = resolveBookListStatus(status, statusName);
  if (resolved === 'active') {
    return { labelKey: 'bookStatus.active', tone: 'success' };
  }
  if (resolved === 'inactive') {
    return { labelKey: 'bookStatus.inactive', tone: 'default' };
  }
  return { labelKey: 'bookStatus.unknown', tone: 'default' };
}

/** Mapping Rule 列表状态码（迁移自 mapping-rule/index.tsx statusMap：30/35/45）。 */
export const MAPPING_RULE_LIST_STATUS = {
  PendingActivation: 30,
  Active: 35,
  Expired: 45,
} as const;

export interface MappingRuleStatusMeta {
  /** 模块命名空间 i18n key（如 'ruleStatus.active'）。 */
  labelKey: string;
  tone: StatusTone;
}

/** 状态码 → 展示元信息（仅 30/35/45 显示 tag，其余返回 null，等价源项目）。 */
export function resolveMappingRuleStatusMeta(
  status?: number
): MappingRuleStatusMeta | null {
  switch (status) {
    case MAPPING_RULE_LIST_STATUS.PendingActivation:
      return { labelKey: 'ruleStatus.pendingActivation', tone: 'warning' };
    case MAPPING_RULE_LIST_STATUS.Active:
      return { labelKey: 'ruleStatus.active', tone: 'success' };
    case MAPPING_RULE_LIST_STATUS.Expired:
      return { labelKey: 'ruleStatus.expired', tone: 'default' };
    default:
      return null;
  }
}

/** Mapping Rule 列表行状态推断（迁移自 resolveEventStatus）。 */
export function resolveEventStatus(
  status?: number,
  effectiveDateTimestamp?: number,
  now = Date.now()
): MappingRuleListStatus {
  if (status === 20 || status === 1) return 'active';
  if (status === 30) return 'pendingActivation';
  if (effectiveDateTimestamp && effectiveDateTimestamp > now && status !== 0) {
    return 'pendingActivation';
  }
  return 'expired';
}

/**
 * 详情 / 历史记录状态码 → 展示元信息（迁移自 BasicInformationTab /
 * HistoricalRecordsTab 的 renderStatusTag，码集 5/10/15/30/35/45）。
 * 仅已知码显示 tag，其余返回 null。
 */
export function resolveEventStatusMeta(
  status?: number
): MappingRuleStatusMeta | null {
  switch (status) {
    case 5:
      return { labelKey: 'eventStatus.draft', tone: 'warning' };
    case 10:
      return { labelKey: 'eventStatus.pendingReview', tone: 'warning' };
    case 15:
      return { labelKey: 'eventStatus.rejected', tone: 'danger' };
    case 30:
      return { labelKey: 'ruleStatus.pendingActivation', tone: 'warning' };
    case 35:
      return { labelKey: 'ruleStatus.active', tone: 'success' };
    case 45:
      return { labelKey: 'ruleStatus.expired', tone: 'default' };
    default:
      return null;
  }
}

/** 色调 → Tailwind class（border + bg + text，呼应源项目 Tag 配色）。 */
export function statusToneClass(tone: StatusTone): string {
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

// ── 展示 helpers ──────────────────────────────────────────────────────────────

/** 时间戳归一：秒 → 毫秒（< 1e12 视为秒）。迁移自源项目 `v >= 1e12 ? v : v * 1000`。 */
export function normalizeTimestamp(
  value?: number | null
): number | undefined {
  if (value === null || value === undefined) return undefined;
  return value >= 1e12 ? value : value * 1000;
}

/** 完整日期时间格式化（迁移自 formatDateTime）。 */
export function formatDateTime(value?: number | null): string {
  const ts = normalizeTimestamp(value);
  if (!ts) return EMPTY_DISPLAY;
  return format(new Date(ts), "MMM d, yyyy, HH:mm:ss '(UTC+8)'");
}

/** 仅日期格式化（迁移自 formatDate）。 */
export function formatDate(value?: number | null): string {
  const ts = normalizeTimestamp(value);
  if (!ts) return EMPTY_DISPLAY;
  return format(new Date(ts), "MMM d, yyyy '(UTC+8)'");
}

/** 资产价值格式化（迁移自 formatAssetValue，支持纯数字与「数值 单位」字符串）。 */
export function formatAssetValue(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') {
    return EMPTY_DISPLAY;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toFixed(2) : EMPTY_DISPLAY;
  }
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return EMPTY_DISPLAY;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return EMPTY_DISPLAY;
  const suffix = match[2].trim();
  return suffix ? `${num.toFixed(2)} ${suffix}` : num.toFixed(2);
}

/** 文本归一：trim，空 → undefined（API 请求参数用）。 */
export function normalizeTextValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// ── 映射逻辑 helpers（edit.tsx）──────────────────────────────────────────────

/** 判断是否系统内置映射行（迁移自 isSystemBuiltinMapping）。 */
export function isSystemBuiltinMapping(item: {
  systemBuiltin?: number;
  mappingField?: string;
}): boolean {
  return (
    item.systemBuiltin === 1 ||
    (item.systemBuiltin !== 2 &&
      typeof item.mappingField === 'string' &&
      FIXED_FIELD_KEY_SET.has(item.mappingField))
  );
}

/** 仅 DIRECT 方法提交 sourceField（迁移自 shouldSubmitSourceField）。 */
export function shouldSubmitSourceField(mappingMethod?: number): boolean {
  return mappingMethod === MAPPING_METHOD_VALUE.DIRECT;
}

/** mappingMethod 数字 → label（DIRECT/CONSTANT/GENERATE 或 --）。 */
export function getMappingMethodLabel(mappingMethod?: number): string {
  if (!mappingMethod) return EMPTY_FIELD_VALUE;
  return MAPPING_METHOD_LABEL[mappingMethod] ?? EMPTY_FIELD_VALUE;
}

/** eventType → sourceEventType（迁移自 getSourceEventTypeByEventType）。 */
export function getSourceEventTypeByEventType(
  eventType?: number
): SourceEventTypeKey | undefined {
  if (!eventType) return undefined;
  return EVENT_TYPE_SOURCE_EVENT_MAP[eventType];
}

/**
 * sourceEventType + bookId → 模块 i18n key。
 *
 * 迁移自 getMappingRuleSourceEventTypeLabelKey。源项目按 bookId 区分 stablecoin/td：
 * td（bookId='2'）的 reserveIn/reserveOut 复用 funding 文案；其余按 sourceEventType 默认。
 */
export function getSourceEventTypeMessageKey(
  sourceEventType?: SourceEventTypeKey,
  bookId?: string
): string | undefined {
  if (!sourceEventType) return undefined;
  if (bookId === TD_BOOK_ID) {
    if (sourceEventType === 'reserveIn') return 'sourceEvent.fundingIn';
    if (sourceEventType === 'reserveOut') return 'sourceEvent.fundingOut';
  }
  return `sourceEvent.${sourceEventType}`;
}

/** mappingMethod → i18n key（'mappingMethod.direct' 等，小写）。 */
export function mappingMethodMessageKey(method?: number): string | undefined {
  const label = getMappingMethodLabel(method);
  if (label === EMPTY_FIELD_VALUE) return undefined;
  return `mappingMethod.${label.toLowerCase()}`;
}
