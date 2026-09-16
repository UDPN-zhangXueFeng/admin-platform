/**
 * LP 资金池域模型（源 `src/types/business.ts` PoolRow + `views/pool/index.vue`
 * 码表；2026-09-11 3a57bbd 只读快照化后申请入参/系统形态码表已随入口剪除）。
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
