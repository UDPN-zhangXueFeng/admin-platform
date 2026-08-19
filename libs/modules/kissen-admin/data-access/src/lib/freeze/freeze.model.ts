/** 冻结目标类型（源 api/freeze.ts：1 银行 / 2 LP / 3 货币对）。 */
export const FREEZE_TARGET_BANK = 1 as const;
export const FREEZE_TARGET_LP = 2 as const;
export const FREEZE_TARGET_PAIR = 3 as const;
export type FreezeTargetType =
  | typeof FREEZE_TARGET_BANK
  | typeof FREEZE_TARGET_LP
  | typeof FREEZE_TARGET_PAIR;

/** 冻结目标类型 → 中文名。 */
export const FREEZE_TARGET_TYPE_LABEL: Record<number, string> = {
  1: 'Bank',
  2: 'LP',
  3: 'Currency Pair',
};

/** 冻结/解冻请求：targetType 1 银行 / 2 LP / 3 货币对；freeze true 冻结 / false 解冻。 */
export interface FreezeToggleReq {
  targetType: number;
  targetId: number;
  freeze: boolean;
}

/** 冻结态语义：status 20 启用 / 50 冻结（停用），与源冻结/解冻动作一一对应。 */
export const FREEZE_STATUS_ACTIVE = 20 as const;
export const FREEZE_STATUS_FROZEN = 50 as const;

/** 仅 20（可冻结）/ 50（可解冻）的目标允许冻结开关（其余如草稿态不参与）。 */
export function isFreezable(status: number): boolean {
  return status === FREEZE_STATUS_ACTIVE || status === FREEZE_STATUS_FROZEN;
}

/** 冻结状态 → Badge variant（20 启用=default / 50 冻结=destructive / 其余=outline）。 */
export function freezeStatusVariant(
  status: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === FREEZE_STATUS_ACTIVE) return 'default';
  if (status === FREEZE_STATUS_FROZEN) return 'destructive';
  return 'outline';
}

/** 冻结状态 → 中文（兜底原样）。 */
export const FREEZE_STATUS_LABEL: Record<number, string> = {
  20: 'Enabled',
  50: 'Frozen',
};

/**
 * 冻结银行行（薄类型：仅冻结列表所需字段，对齐源 api/bank.ts BankRow 子集）。
 * 跨域薄调用，不复用他组 data-access，避免并行耦合（计划 §3 Group G 约定）。
 */
export interface FreezeBankRow {
  bankId: number;
  bankName: string;
  bankCode: string;
  status: number;
}

export interface FreezeBankFilter {
  bankName?: string;
  status?: number;
}

/** 冻结 LP 行（薄类型，对齐源 api/lp.ts LpRow 子集）。 */
export interface FreezeLpRow {
  lpId: number;
  lpName: string;
  lpCode: string;
  status: number;
}

export interface FreezeLpFilter {
  lpName?: string;
  status?: number;
}

/** 冻结货币对行（薄类型，对齐源 api/currency-pair.ts CurrencyPairRow 子集）。 */
export interface FreezePairRow {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  status: number;
}

export interface FreezePairFilter {
  sourceCurrency?: string;
  targetCurrency?: string;
  status?: number;
}
