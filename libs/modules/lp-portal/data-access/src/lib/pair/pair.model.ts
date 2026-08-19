/**
 * LP 货币对与资金池域模型（源 `src/types/business.ts` PairRow/PairPoolAgg 系 +
 * `src/views/pair-pool/index.vue` 码表）。
 *
 * 行类型已在公共 `../types` 平移声明（pair/list 与 pair-pool/list 均不分页
 * 全量返回），本域仅重导出锚定 + 补充视图级状态映射，避免重复声明
 * （rate 域同模式，主 barrel 追加 star 导出无同名歧义）。
 *
 * capable 由 api 侧判定（FR-P-10），前端只渲染；gaps 缺口码的中文文案映射
 * 由前端承担（裁决 C-4）；lpId 由 BFF 登录域注入，前端不传。
 */
import type {
  PairPoolAgg,
  PairPoolSourcePool,
  PairPoolTargetPool,
  PairRow,
  PreauthItem,
} from '../types';

export type {
  PairPoolAgg,
  PairPoolSourcePool,
  PairPoolTargetPool,
  PairRow,
  PreauthItem,
};

/** 参与状态文案（源 PARTICIPATION_TEXT：20 生效 / 50 停用；未知码显原值）。 */
export const PAIR_PARTICIPATION_TEXT: Record<number, string> = {
  20: 'Active',
  50: 'Disabled',
};

/** 参与状态 → Badge variant（源 el-tag：20 success / 其他 info 的中性映射）。 */
export const PAIR_PARTICIPATION_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
};

/** 货币对状态文案（源 PAIR_STATUS_TEXT：20 启用 / 50 停用；未知码显原值）。 */
export const PAIR_STATUS_TEXT: Record<number, string> = {
  20: 'Enabled',
  50: 'Disabled',
};

/** 货币对状态 → Badge variant（源 el-tag：20 success / 其他 info）。 */
export const PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
};

/** 预授权状态文案（源 PREAUTH_STATUS_TEXT：20 有效 / 50 已撤销；未知码显原值）。 */
export const PREAUTH_STATUS_TEXT: Record<number, string> = {
  20: 'Valid',
  50: 'Revoked',
};

/** 预授权状态 → Badge variant（源 el-tag：20 success / 其他 info）。 */
export const PREAUTH_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
};

/**
 * 缺口码 → 中文文案（裁决 C-4，映射由前端承担）；未知码兜底显原码。
 * capable/gaps 由 api 侧判定产出，前端仅按码表渲染。
 */
export const PAIR_GAP_TEXT: Record<string, string> = {
  NO_POOL: 'No Liquidity Pool',
  NO_PREAUTH: 'No Pre-authorization',
  PREAUTH_EXPIRED: 'Pre-authorization Expired',
  QUOTA_INSUFFICIENT: 'Insufficient Quota',
  LOW_LEVEL: 'Level Below Threshold',
  PARTICIPATION_STOPPED: 'Participation Disabled',
};
