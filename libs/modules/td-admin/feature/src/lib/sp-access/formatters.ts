import { formatAdminDateTime } from '@myorg/shared/util-dates';
import {
  FALLBACK_PRIVATE_KEY_CUSTODY_MODEL,
  TRANSACTION_POLICY_FIXED,
} from './constants';

/** 空值占位（与 approval-manage 等模块一致） */
export const EMPTY_FIELD_VALUE = '--';

/** 时间统一走 util-dates（不自造格式，constraints §1） */
export function formatTimestamp(value?: number | null): string {
  if (!value) return EMPTY_FIELD_VALUE;
  return formatAdminDateTime(new Date(value));
}

/**
 * 数值防御（constraints §7）：后端 number 字段实际可能下发 string。
 * null/undefined/NaN/'' → '--'；其余 Number() 后两位小数。
 */
export function formatAmount(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return EMPTY_FIELD_VALUE;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return EMPTY_FIELD_VALUE;
  return numeric.toFixed(2);
}

/** 首个非空（tdName>blockchainName>symbol 之类的字段优先级链） */
export function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** `tdName (Based on blockchainName)`；无链名时仅 tdName */
export function formatTokenDisplayName(
  tdName?: string,
  blockchainName?: string,
): string {
  const name = firstNonEmpty(tdName, blockchainName);
  if (!name) return EMPTY_FIELD_VALUE;
  const chain = blockchainName?.trim();
  return chain && chain !== name ? `${name} (Based on ${chain})` : name;
}

export function parsePrivateKeyCustodyModel(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** parse 失败（空/脏值）兜底 ['sp','end_user']（上游 getPrivateKeyCustodyModel） */
export function parsePrivateKeyCustodyModelWithFallback(value?: string): string[] {
  const parsed = parsePrivateKeyCustodyModel(value);
  return parsed.length ? parsed : [...FALLBACK_PRIVATE_KEY_CUSTODY_MODEL];
}

export function serializePrivateKeyCustodyModel(values: string[]): string {
  return Array.from(new Set(values))
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

/**
 * 交易提交策略解析（上游 BaseInfo.parseTransactionPolicy）：
 * 空值 → []；逗号拆分 + 去空白，保留原顺序。
 */
export function parseTransactionPolicy(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** 交易提交策略序列化：去空白 + 字典序排序 + 逗号拼接（编辑提交 round-trip） */
export function serializeTransactionPolicy(values: string[]): string {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

/**
 * Token KYC 归一（上游 getKycRequiredLabel 语义：2=Yes，1/0=No）。
 * 返回归一化 token 供调用方映射 PUB_Yes/PUB_No 文案；无法识别返回空串。
 */
export function formatTokenKycRequiredLabel(
  value: unknown,
): 'yes' | 'no' | '' {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'yes') return 'yes';
    if (normalized === 'no') return 'no';
    return '';
  }
  if (typeof value === 'number') {
    if (value === 2) return 'yes';
    if (value === 1 || value === 0) return 'no';
  }
  return '';
}

/** 交易提交策略恒 '1,2'（上游双只读 Switch） */
export function getFixedTransactionPolicy(): string {
  return TRANSACTION_POLICY_FIXED;
}

/** 权限名单展示：前 N 个名 + `+N...`（上游 >6 折叠） */
export function buildPermissionPreview(names: string[], previewCount: number) {
  const visible = names.slice(0, previewCount);
  const restCount = Math.max(0, names.length - visible.length);
  return { visibleNames: visible, restCount };
}
