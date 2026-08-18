/**
 * LP 资金池域模型（源 `types/business.ts` PoolRow + `views/pool/index.vue` 码表）。
 *
 * pool/list 为不分页全量列表（源 api/pool.ts body {}）；`level` 为水位小数比率
 * 0〜1，minLimit≤0 时后端返回 null（裁决 C-7）；`remindThreshold` 与 level 同口径
 * 比值比较（裁决 C-8，非余额比金额）。lpId 由 BFF 登录域注入，前端不传。
 */

export interface PoolRow {
  poolId: number;
  currency: string;
  /** 账户地址，页面经 maskAddress 掩码展示 */
  accountAddress: string;
  /** 1 链上 EVM / 2 Aptos / 3 内部系统 */
  currencySystemType: number;
  minLimit: number | string;
  /** 水位提醒阈值（比率 0〜1，与 level 比较，非金额；裁决 C-8） */
  remindThreshold: number | string | null;
  availableBalanceCache: number | string;
  balanceUpdateTime: number | null;
  /** 水位 = 余额缓存 ÷ 最低限额，小数比率；minLimit≤0 时 null（裁决 C-7） */
  level: number | string | null;
  /** 20 正常 / 50 停用 */
  status: number;
}

/** 货币系统形态映射（源 SYSTEM_TYPE_TEXT；未知码由页面显原值） */
export const POOL_SYSTEM_TYPE_TEXT: Record<number, string> = {
  1: '链上 EVM',
  2: 'Aptos',
  3: '内部系统',
};

/** 池状态文案（源 POOL_STATUS_TEXT；未知码由页面显原值） */
export const POOL_STATUS_TEXT: Record<number, string> = {
  20: '正常',
  50: '停用',
};

/** 池状态 → Badge variant（源 el-tag {20:success,50:info} 的等价映射，兜底 outline）。 */
export const POOL_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
  50: 'secondary',
};
