/**
 * Approval Management 模块纯函数 helpers。
 *
 * 迁移自 td-manage：
 * - `libs/utils/get/getDateFormat.ts` 的 formatTimestamp（date/dateutc 语义）
 * - `libs/utils/index.ts` 的 reSet（金额千分位格式化）
 * - `src/pages/approval-manage/components/{token,serviceProvider,financial-*}.tsx` 的局部纯函数
 *
 * 全部为纯函数，便于单测（jest 仅 util 层可行，见记忆「验证硬限制」）。
 * 仅依赖 date-fns（目标库既有格式化依赖，见 wallet/tx-event-config util），零业务耦合。
 *
 * NOTE: MetaMask 签名相关 helpers（connectToMetamask/signMessage/convertTxHashToRSV）
 * 为副作用函数（ethers 浏览器 API），不属纯函数 util，将在 feature 层 operation-panel
 * 任务移植（见迁移文档 §7.13、§8）。此处只放纯函数。
 */
import { format } from 'date-fns';

import { EMPTY_FIELD_VALUE } from './approval-manage.constants';

// ── 时间戳格式化（迁移自 libs/utils formatTimestamp）────────────────────────────

/**
 * 时间戳 → 展示字符串（迁移自 libs/utils/get/getDateFormat.ts formatTimestamp）。
 *
 * 三种模式（照源语义，勿改）：
 * - `'date'`    → 'MMM d, yyyy'（仅日期）
 * - `'dateutc'` → 'MMM d, yyyy UTC Z'（日期 + UTC 时区）
 * - 默认         → 'MMM d, yyyy, HH:mm:ss UTC Z'（完整日期时间 + UTC 时区）
 *
 * 无值（0/undefined/null）→ '--'。
 *
 * NOTE: 源用 dayjs，目标库约定用 date-fns（见 tx-event-config util formatDateTime）。
 * 格式串等价转换：源 'MMM D, YYYY' → date-fns 'MMM d, yyyy'（D→d，YYYY→yyyy）。
 */
export function formatTimestamp(
  timestamp?: number | null,
  type?: 'date' | 'dateutc'
): string {
  if (!timestamp) return EMPTY_FIELD_VALUE;
  if (type === 'date') {
    return format(new Date(timestamp), 'MMM d, yyyy');
  }
  if (type === 'dateutc') {
    return format(new Date(timestamp), 'MMM d, yyyy xxx');
  }
  return format(new Date(timestamp), 'MMM d, yyyy, HH:mm:ss xxx');
}

/**
 * 时间戳归一：秒 → 毫秒（< 1e12 视为秒）。迁移自源 normalizeTimestamp
 * （financial-normalization.tsx:93 / financial-posting-rule.tsx:53）。
 */
export function normalizeTimestamp(
  value?: number | null
): number | undefined {
  if (value === null || value === undefined) return undefined;
  return value >= 1e12 ? value : value * 1000;
}

// ── 金额格式化（迁移自 libs/utils reSet）────────────────────────────────────────

/**
 * 金额千分位格式化（迁移自 libs/utils/index.ts:46 reSet）。
 *
 * 语义（照源，勿改）：
 * - value >= 0 → toFixed(len) + 千分位逗号（len>0 按 `(?=(\d{3})+\.)`，len=0 按 `(?=(\d{3}))`）
 * - value < 0 / 非数 → '--'
 *
 * 源用 `value >= 0` 判定（非 isFinite），故字符串/undefined 会走 else 分支返回 '--'，
 * 此处保留源行为：显式 Number 化后判定。
 */
export function reSet(value: unknown, len = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return EMPTY_FIELD_VALUE;
  if (len > 0) {
    return num.toFixed(len).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
  }
  return num
    .toFixed(len)
    .replace(/(\d)(?=(\d{3}))/g, '$1,');
}

// ── 空值判定（迁移自 token.tsx:19 hasValue）────────────────────────────────────

/**
 * 判定值是否「有内容」（迁移自 token.tsx:19 hasValue）。
 * 非 null/undefined 且 trim 后非空字符串。用于条件渲染段（COA/KeyCustody/AdminWallet）。
 */
export function hasValue(value: unknown): boolean {
  return (
    value !== undefined && value !== null && String(value).trim() !== ''
  );
}

/** 任一值为真（迁移自 token.tsx hasCoaSetup/hasKeyCustody 的 `.some(hasValue)` 用法）。 */
export function anyHasValue(values: unknown[]): boolean {
  return values.some(hasValue);
}

// ── 逗号分隔选择解析（迁移自 serviceProvider.tsx:38 parseCommaSelection）──────────

/**
 * 逗号分隔字符串 → 去重 trim 后的数组（迁移自 serviceProvider.tsx:38
 * parseCommaSelection）。空值 → []。用于 PRIVATE_KEY_CUSTODY/TRANSACTION_POLICY 回填。
 */
export function parseCommaSelection(value?: string | number | null): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

// ── 新旧差异展示（迁移自 serviceProvider.tsx:134 renderUpdatedValue）────────────

/**
 * 新旧值差异展示（迁移自 serviceProvider.tsx:134 renderUpdatedValue）。
 *
 * 语义（照源）：
 * - origin/latest 各自 trim，空 → '--'。
 * - 无 latest 或 origin===latest → 直接返回 to（无「Updated from ... to ...」前缀）。
 * - 否则 → `${fromLabel}${from}${toLabel}${to}`，fromLabel/toLabel 由调用方传入
 *   （源用 t('sp_access_0069') / t('sp_access_0070')，本纯函数不耦合 i18n）。
 *
 * @param originValue  旧值
 * @param latestValue  新值
 * @param labels       差异文案对（from 前缀 + to 前缀），默认 'Updated from ' / ' to '
 *                     （源英文兜底，调用方可传 i18n 文案覆盖）
 */
export function renderUpdatedValue(
  originValue?: string | null,
  latestValue?: string | null,
  labels: { from?: string; to?: string } = {}
): string {
  const from = originValue?.trim() || EMPTY_FIELD_VALUE;
  const to = latestValue?.trim() || EMPTY_FIELD_VALUE;
  const fromLabel = labels.from ?? 'Updated from ';
  const toLabel = labels.to ?? ' to ';

  if (!latestValue || from === to) {
    return to;
  }
  return `${fromLabel}${from}${toLabel}${to}`;
}

// ── account/code-name 展示（合并 financial-coa formatAccountDisplay + posting getAccountLabel）──

/**
 * code/name 组合展示（合并 financial-coa.tsx formatAccountDisplay +
 * financial-posting-rule.tsx getAccountLabel）。
 *
 * 语义（取 coa 版，更明确）：code/name 都空 → '--'；否则 `${code||'--'} - ${name||'--'}`。
 * posting 版用 filter(Boolean).join(' - ')，空值不补 '--'——两版语义冲突，
 * 按 Rule 7 取 coa 版（显式 '--' 兜底，更稳健，dispatcher/detail 组件普遍需要 '--'）。
 */
export function formatCodeName(
  code?: string | null,
  name?: string | null
): string {
  if (!code && !name) return EMPTY_FIELD_VALUE;
  const c = code || EMPTY_FIELD_VALUE;
  const n = name || EMPTY_FIELD_VALUE;
  return `${c} - ${n}`;
}

// ── financial 时间格式化（迁移自 financial-normalization/posting formatDateTime/formatDate）──

/**
 * 完整日期时间（含 UTC+8 标注）。迁移自 financial-normalization.tsx:98 formatDateTime。
 * 用于 financial 审核组件（与列表/详情的 formatTimestamp 时区风格不同，照源保留）。
 */
export function formatFinancialDateTime(value?: number | null): string {
  const ts = normalizeTimestamp(value);
  if (!ts) return EMPTY_FIELD_VALUE;
  return format(new Date(ts), "MMM d, yyyy, HH:mm:ss '(UTC+8)'");
}

/** 仅日期（含 UTC+8 标注）。迁移自 financial-normalization.tsx:104 formatDate。 */
export function formatFinancialDate(value?: number | null): string {
  const ts = normalizeTimestamp(value);
  if (!ts) return EMPTY_FIELD_VALUE;
  return format(new Date(ts), "MMM d, yyyy '(UTC+8)'");
}
