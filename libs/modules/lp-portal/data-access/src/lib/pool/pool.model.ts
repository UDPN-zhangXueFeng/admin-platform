/**
 * LP 资金池域模型（源 `src/types/business.ts` PoolRow + `views/pool/index.vue`
 * 码表 + `api/pool.ts` apply 入参）。
 *
 * 行类型已在公共 `../types` 平移声明（v2 源本地副本：poolId/tokenId/tokenNo/
 * tokenCode/bankCode/poolAddress/status 5|15|20|50/rejectReason/余额与水位
 * 快照/syncTime），本域重导出锚定 + 补充视图级映射（pair/log 域同模式，主
 * barrel star 导出无同名歧义）。
 *
 * pool/list 不分页全量返回；lpId 由 BFF 登录域注入，前端不传。
 */
import type { PoolRow } from '../types';

export type { PoolRow };

/** 开池申请入参（FR-LW-03，POST /pool/apply；受理即回流列表「Pending」）。 */
export interface PoolApplyReq {
  tokenId: number;
  /** 货币系统账户地址（页面 trim 后提交）。 */
  accountAddress: string;
  currencySystemType?: number;
  /** 水位提醒阈值（比率 0〜1，step 0.05，默认 0.2）。 */
  remindThreshold?: number;
}

/** 货币系统形态映射（开池弹窗 select 码表；未知码由页面显原值）。 */
export const POOL_SYSTEM_TYPE_TEXT: Record<number, string> = {
  1: 'On-chain EVM',
  2: 'Aptos',
  3: 'Internal System',
};

/** 池状态文案（源 STATUS_TEXT{5申请中,15已驳回,20已开通,50停用}；未知码显原值）。 */
export const POOL_STATUS_TEXT: Record<number, string> = {
  5: 'Pending',
  15: 'Rejected',
  20: 'Active',
  50: 'Disabled',
};

/**
 * 池状态 → Badge variant（源 el-tag {5:warning,15:danger,20:success,50:info}；
 * warning→outline、info→secondary 同 tx-flow 域口径，未知码页面兜底 secondary）。
 */
export const POOL_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'outline',
  15: 'destructive',
  20: 'default',
  50: 'secondary',
};
