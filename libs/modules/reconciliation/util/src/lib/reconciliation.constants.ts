/**
 * Reconciliation 模块常量与状态码映射。
 *
 * 遵循 ts-set-map 规则：静态字面量查找表用 `Record<K,V>`，动态值集合用 `Set`。
 * 迁移自 td-manage `reconciliation/{real-time,reserve}/detail.tsx` 内联 switch 映射，
 * 收敛为模块级单一定义（Rule 7：取全集，调用方无须区分 real-time/reserve）。
 *
 * 动态 i18n key 走 flat `prefix_${n}` 拼接（对齐 approval-manage
 * `common_approval_status_${n}` 范式），值集合守卫防御 next-intl 缺失 key 抛错。
 */

// ── 基础常量 ──────────────────────────────────────────────────────────────────

/** 空值占位（与 approval-manage EMPTY_FIELD_VALUE 对齐）。 */
export const EMPTY_FIELD_VALUE = '--';

/** 列表默认每页条数（与 approval-manage 一致）。 */
export const DEFAULT_PAGE_SIZE = 10;

/** Real-time investigation 前端过滤状态码（R2：real-time 过滤 status=3）。 */
export const INVESTIGATION_STATUS = 3;

// ── Token 类型 ─────────────────────────────────────────────────────────────────

/** Token 类型枚举：1=Stablecoin, 5=TD。 */
export const TOKEN_TYPE = {
  STABLECOIN: 1,
  TD: 5,
} as const;

/** 已补全 i18n 词条的 tokenType 值集合。 */
export const TOKEN_TYPE_VALUES = new Set<number>([1, 5]);

/** tokenType → i18n key（`token_type_${n}`）。 */
export function getTokenTypeKey(tokenType?: number): string | undefined {
  if (tokenType == null || !TOKEN_TYPE_VALUES.has(tokenType)) return undefined;
  return `token_type_${tokenType}`;
}

// ── Real-time tx 类型 ──────────────────────────────────────────────────────────

/** Real-time tx 类型全集（5/10/15/20/25）。 */
export const TX_TYPE_VALUES = new Set<number>([5, 10, 15, 20, 25]);

/** TD token 可选 tx 类型子集（详情页 tokenType=TD 时裁剪为 3 类）。 */
export const TD_TX_TYPE_VALUES = new Set<number>([10, 15, 25]);

/** txType → i18n key（`tx_type_${n}`）。 */
export function getTxTypeKey(txType?: number): string | undefined {
  if (txType == null || !TX_TYPE_VALUES.has(txType)) return undefined;
  return `tx_type_${txType}`;
}

// ── Real-time 对账状态(1-6) ───────────────────────────────────────────────────

/** Real-time 对账状态值集合。 */
export const RECON_STATUS_VALUES = new Set<number>([1, 2, 3, 4, 5, 6]);

/** real-time status → i18n key（`reconciliation_status_${n}`）。 */
export function getReconStatusKey(status?: number): string | undefined {
  if (status == null || !RECON_STATUS_VALUES.has(status)) return undefined;
  return `reconciliation_status_${status}`;
}

/** real-time status → badge tone。Record 静态查找表。 */
export const RECON_STATUS_TONE: Record<number, string> = {
  1: 'default',
  2: 'warning',
  3: 'destructive',
  4: 'secondary',
  5: 'info',
  6: 'success',
};

// ── Reserve 对账状态(0-5) ──────────────────────────────────────────────────────

/** Reserve 对账状态值集合。 */
export const RESERVE_STATUS_VALUES = new Set<number>([0, 1, 2, 3, 4, 5]);

/** reserve status → i18n key（`reserve_status_${n}`）。 */
export function getReserveStatusKey(status?: number): string | undefined {
  if (status == null || !RESERVE_STATUS_VALUES.has(status)) return undefined;
  return `reserve_status_${status}`;
}

/** reserve status → badge tone。 */
export const RESERVE_STATUS_TONE: Record<number, string> = {
  0: 'default',
  1: 'info',
  2: 'warning',
  3: 'destructive',
  4: 'secondary',
  5: 'success',
};

// ── Reserve 类型 ───────────────────────────────────────────────────────────────

/** Reserve 类型枚举：1=Mint, 2=Reserve Out/Melt。 */
export const RESERVE_TYPE = {
  MINT: 1,
  RESERVE_OUT: 2,
} as const;

/** reserve type 值集合。 */
export const RESERVE_TYPE_VALUES = new Set<number>([1, 2]);

/** reserve type → i18n key（`reserve_type_${n}`）。 */
export function getReserveTypeKey(type?: number): string | undefined {
  if (type == null || !RESERVE_TYPE_VALUES.has(type)) return undefined;
  return `reserve_type_${type}`;
}

// ── Unmatched 类型 ─────────────────────────────────────────────────────────────

/** Unmatched 类型：1=System Only, 2=On-chain Only, 3=Amount Mismatched。 */
export const UNMATCHED_TYPE_VALUES = new Set<number>([1, 2, 3]);

/** unmatchedType → i18n key（`unmatched_type_${n}`）。 */
export function getUnmatchedTypeKey(type?: number): string | undefined {
  if (type == null || !UNMATCHED_TYPE_VALUES.has(type)) return undefined;
  return `unmatched_type_${type}`;
}

// ── 借贷方向 ───────────────────────────────────────────────────────────────────

/** 借贷方向枚举：1=Dr(借), 2=Cr(贷)。 */
export const DIRECTION = {
  DEBIT: 1,
  CREDIT: 2,
} as const;

/** direction → i18n key（`direction_${n}`）。 */
export const DIRECTION_KEY: Record<number, string> = {
  1: 'direction_debit',
  2: 'direction_credit',
};

export function getDirectionKey(direction?: number): string | undefined {
  if (direction == null) return undefined;
  return DIRECTION_KEY[direction];
}

// ── 动态 i18n key 前缀全集（确保 namespace 含词条，渲染时 `t(prefix + n)`） ────

export const DYNAMIC_I18N_KEY_PREFIXES = [
  'token_type_',
  'tx_type_',
  'reconciliation_status_',
  'reserve_status_',
  'reserve_type_',
  'unmatched_type_',
  'direction_',
] as const;

// ── 权限 ───────────────────────────────────────────────────────────────────────

/** Reconciliation 权限键（语义化占位，与 approval-manage 模式一致）。 */
export const RECONCILIATION_PERMISSIONS = {
  VIEW: 'reconciliation:view',
} as const;
