/**
 * 货币对域数据模型（源 `types/business.ts` CurrencyPair，gw_currency_pair 推送缓存）。
 */

/** 货币对行（GET /currencypair/list）。status：20 启用 / 其他 停用（源 currency-pair.vue 按 `status === 20` 判定）。 */
export interface CurrencyPair {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  userRate: number;
  status: number;
  version?: number;
  pushTime?: number;
}

/** 货币对状态文案（源 currency-pair.vue：status === 20 ? '启用' : '停用'；未知状态按停用兜底）。 */
export const CURRENCY_PAIR_STATUS_LABEL: Record<number, string> = {
  20: '启用',
  50: '停用',
};

/** 货币对状态 → Badge variant（启用=default，停用/未知=outline；对齐 kissen-admin conventions §5）。 */
export const CURRENCY_PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
  50: 'outline',
};
