/**
 * Wallet 模块纯函数 helpers。
 *
 * 迁移自 td-manage `src/pages/wallet/*`。全部为纯函数，便于单测。
 * NOTE: keystore 密码加密 `getEncryptionData` 在 Phase 7（mff-add/edit）按需从源
 * `libs/utils/get/getEncryptionData` 移植，此处暂不引入（避免未使用的加密依赖）。
 */
import { UNLIMITED_THRESHOLD } from './wallet.constants';

/** 时间戳归一：秒 → 毫秒（< 1e12 视为秒）。迁移自源项目 `v >= 1e12 ? v : v * 1000`。 */
export function toMillis(value?: number | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  return value >= 1e12 ? value : value * 1000;
}

/**
 * 列表行 id 注入工厂（满足 DataTable `{ id: string }` 契约）。
 *
 * 多数 wallet 列表行无 `id` 字段，按业务键组合出稳定唯一字符串。
 */
export function normalizeRowId(
  ...parts: Array<string | number | undefined | null>
): string {
  return parts
    .map((p) => (p === undefined || p === null ? '' : String(p)))
    .join('|');
}

/**
 * 限额展示：≥ 阈值视为无限制，返回 ∞；否则原值。
 * 迁移自源项目 formatLimit（user-wallet/view.tsx、wallet-type/view.tsx）。
 */
export function formatLimit(value?: number | null): string {
  if (value === undefined || value === null) return '';
  return value >= UNLIMITED_THRESHOLD ? '∞' : String(value);
}

/**
 * 限额提交归一：≥ 阈值或空 → -1（后端「无限制」语义）。
 * 迁移自源项目 wallet-type/edit.tsx 提交逻辑。
 */
export function normalizeLimitForSubmit(value?: number | null): number {
  if (value === undefined || value === null || value >= UNLIMITED_THRESHOLD) {
    return -1;
  }
  return value;
}

// ── user-wallet view tab 解析 ─────────────────────────────────────────────────

/** user-wallet 详情 5 tab 的稳定 key（迁移自源 view.tsx resolveWalletViewTabKey）。 */
export const USER_WALLET_VIEW_TAB = {
  Basic: 'basic',
  Transactions: 'transactions',
  Operations: 'operations',
  Accrual: 'accrual',
  Distribution: 'distribution',
} as const;

export type UserWalletViewTab =
  (typeof USER_WALLET_VIEW_TAB)[keyof typeof USER_WALLET_VIEW_TAB];

/** tab 别名 / 数字 → 稳定 key 的映射（源同时支持 1..5 与命名别名）。 */
const TAB_ALIASES: Record<string, UserWalletViewTab> = {
  '1': USER_WALLET_VIEW_TAB.Basic,
  basic: USER_WALLET_VIEW_TAB.Basic,
  '2': USER_WALLET_VIEW_TAB.Transactions,
  transactions: USER_WALLET_VIEW_TAB.Transactions,
  '3': USER_WALLET_VIEW_TAB.Operations,
  operations: USER_WALLET_VIEW_TAB.Operations,
  '4': USER_WALLET_VIEW_TAB.Accrual,
  accrual: USER_WALLET_VIEW_TAB.Accrual,
  '5': USER_WALLET_VIEW_TAB.Distribution,
  distribution: USER_WALLET_VIEW_TAB.Distribution,
};

/**
 * 解析 query `tab` 值为稳定 tab key，非法/缺失 → basic。
 *
 * 源项目接受 `1..5` 与 `basic|transactions|operations|accrual|distribution` 两类别名。
 */
export function resolveWalletViewTabKey(tab?: string | null): UserWalletViewTab {
  if (!tab) return USER_WALLET_VIEW_TAB.Basic;
  return TAB_ALIASES[String(tab).toLowerCase()] ?? USER_WALLET_VIEW_TAB.Basic;
}

/** MMF 判定：issueType === 20。 */
export function isMmf(issueType?: number | null): boolean {
  return issueType === 20;
}
