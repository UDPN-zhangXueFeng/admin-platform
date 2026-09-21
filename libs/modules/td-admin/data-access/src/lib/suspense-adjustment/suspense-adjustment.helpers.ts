/**
 * Suspense Adjustment 纯函数工具集。
 *
 * 迁移自 td-manage src/lib/components/financial/adjustments/helpers.ts。
 * 设计原则：纯函数，只做确定性转换，不发请求 / 不弹 toast / 不跳路由。
 * 枚举映射收口到本文件 + suspense-adjustment.constants.ts。
 *
 * 依赖业务 Domain Model 的转换（getSuspenseAccountLine / getOffsettingEntryFor
 * / buildAdjustPayload）在 data-access 层——util 不可依赖 data-access（层级约束）。
 */
import {
  ADJUSTMENT_STATUS_CODE_MAP,
  AGE_DANGER_THRESHOLD,
  AGE_TAG_TONES,
  AGE_WARN_THRESHOLD,
  CLEAR_STATUS_CODE_MAP,
  SOURCE_TYPE_CODE_MAP,
} from './suspense-adjustment.constants';
import type {
  AdjustmentStatus,
  ClearStatus,
  DrCr,
  SourceType,
} from './suspense-adjustment.constants';

/**
 * 金额格式化：千分位 + 2 位小数 + 可选币种，例如 '1,000.00 EUR'。
 * 空值 / 非数回 '--'，避免在多个页面重复定义。
 */
export const formatAmount = (
  amount: number | null | undefined,
  currency?: string,
): string => {
  if (amount == null || Number.isNaN(Number(amount))) {
    return currency ? `-- ${currency}` : '--';
  }
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
};

/** 文本降级：空值统一回 '--'。 */
export const textOrDash = (value: string | null | undefined): string =>
  value || '--';

/**
 * 后端 sourceType 数值 → Domain 枚举。
 * 未知值兜底返回 undefined，由调用方决定降级策略（不静默捏造枚举）。
 */
export const mapSourceType = (
  value: number | string | null | undefined,
): SourceType | undefined =>
  value == null ? undefined : SOURCE_TYPE_CODE_MAP[Number(value)];

/**
 * 后端审批状态数值 → Domain 枚举（5/10/15/20/3）。
 * 未知值返回 undefined。
 */
export const mapAdjustmentStatus = (
  value: number | string | null | undefined,
): AdjustmentStatus | undefined =>
  value == null ? undefined : ADJUSTMENT_STATUS_CODE_MAP[Number(value)];

/**
 * 清账状态 → Domain 枚举。
 *
 * 入参兼容三种形态：
 * - 列表 / 详情响应的文本（'Outstanding' / 'Partially Cleared' / 'Cleared'）—— 主路径。
 * - 列表查询参数的数值编码（1/2/3）。
 * - 已是 Domain 枚举字符串（透传）。
 *
 * 未匹配返回 undefined（不静默兜底）。
 */
export const mapClearStatus = (
  value: number | string | null | undefined,
): ClearStatus | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'number') return CLEAR_STATUS_CODE_MAP[value];
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'outstanding':
      return 'OUTSTANDING';
    case 'partially cleared':
    case 'partially':
      return 'PARTIALLY_CLEARED';
    case 'cleared':
      return 'CLEARED';
    default:
      return undefined;
  }
};

/**
 * 账龄 → Age Tag 色值 token。
 * - 1–3 天：default
 * - 4–7 天：orange（≥ AGE_WARN_THRESHOLD）
 * - ≥8 天：red（≥ AGE_DANGER_THRESHOLD）
 */
export const getAgeTagTone = (age: number): string => {
  if (age >= AGE_DANGER_THRESHOLD) return AGE_TAG_TONES.DANGER;
  if (age >= AGE_WARN_THRESHOLD) return AGE_TAG_TONES.WARN;
  return AGE_TAG_TONES.NORMAL;
};

/**
 * 本次调账合计 = Σ entries.amount（仅累加有效正数，空串 / 非数 / ≤0 视为 0）。
 * 纯累加，不做上限校验（上限校验由表单层负责，保持函数单一职责）。
 */
export const calculateThisAdjustment = (
  entries: Array<{ amount: number | null }>,
): number =>
  entries.reduce<number>((sum, e) => {
    const n = typeof e.amount === 'number' && e.amount > 0 ? e.amount : 0;
    return sum + n;
  }, 0);

/**
 * 本次后剩余 = outstandingAmount - thisAdjustment。
 * 不允许负数，下限 clamp 到 0。
 */
export const calculateRemainingAfter = (
  outstandingAmount: number,
  thisAdjustment: number,
): number => Math.max(0, (outstandingAmount ?? 0) - (thisAdjustment ?? 0));

/**
 * Adjust 表单 Posting Date 默认值。
 * 优先取后端返回的记账日期；缺失时回退「今天」，均输出 YYYY-MM-DD。
 */
export const getDefaultPostingDate = (detail?: {
  postingDate?: string;
}): string => {
  if (detail?.postingDate) return detail.postingDate;
  return new Date().toISOString().slice(0, 10);
};

/**
 * epoch millis → YYYY-MM-DD（UTC，与后端 postingDate 一致使用 epoch 表达）。
 * 入参非法返回 undefined，由调用方决定降级文案。
 */
export const epochToDateString = (
  millis: number | null | undefined,
): string | undefined => {
  if (millis == null || Number.isNaN(Number(millis))) return undefined;
  return new Date(Number(millis)).toISOString().slice(0, 10);
};

/**
 * Created on 展示格式：`Jul 07, 2026, 17:00:00 (UTC+8)`。
 * 后端给 epoch millis；mock / 旧数据可能给日期字符串，因此保留 string 兼容。
 */
export const formatCreatedOnDateTime = (
  value: number | string | null | undefined,
): string | undefined => {
  if (value == null || value === '') return undefined;

  const date =
    typeof value === 'number'
      ? new Date(value)
      : new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value,
        );

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : undefined;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\s(\d{2}):/, ' $1:')
    .concat(' (UTC+8)');
};

/** YYYY-MM-DD → 当日 epoch millis（UTC 00:00:00.000）。用于构造列表查询与 /adjust 的日期入参。 */
type DateInput =
  | string
  | number
  | {
      format?: (template: string) => string;
      valueOf?: () => number;
    }
  | undefined;

export const dateStringToEpoch = (date: DateInput): number | undefined => {
  if (!date) return undefined;
  if (typeof date === 'number') {
    return Number.isFinite(date) ? date : undefined;
  }
  if (typeof date === 'object') {
    if (typeof date.format === 'function') {
      return dateStringToEpoch(date.format('YYYY-MM-DD'));
    }
    if (typeof date.valueOf === 'function') {
      const value = date.valueOf();
      return Number.isFinite(value) ? value : undefined;
    }
  }
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(ms) ? undefined : ms;
};

/**
 * New Adjustment Entry 的抵账方向。
 * 始终与暂记分录方向相反：暂记为 Dr → 抵账为 Cr，反之亦然。
 */
export const getOffsettingDirection = (suspenseDrCr: DrCr): DrCr =>
  suspenseDrCr === 'Dr' ? 'Cr' : 'Dr';
