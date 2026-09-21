/**
 * LP 预授权（源 `api/lp-preauth.ts` LpPreauthRespVO；rowKey=preauthId）。
 *
 * v2.0 token 化：tokenId/tokenCode 替代 currency；凭证字段（authCredential/
 * authCsTxId）不再返回（资金系统独占管理）；可用授权 preauthAvailable
 * 直接采用接口 2 查询值（availableAmount 口径），非前端差值。
 */

export interface LpPreauthRow {
  preauthId: number;
  lpId: number;
  lpName: string;
  poolId: number;
  /** v2.0 token 维度（currency 列已废弃）。 */
  tokenId: number;
  tokenCode: string;
  /** 授权总额。 */
  authAmount: string | number;
  /** 已使用授权额。 */
  usedAmount: string | number;
  /** 可用授权（接口 2 查询值，availableAmount 口径；非前端差值）。 */
  availableAmount: string | number;
  /** 授权起始时间（毫秒；页面未展示）。 */
  validFrom: number;
  /** 授权有效期至（毫秒；页面未展示）。 */
  validTo: number;
  /** 快照时间（毫秒）。 */
  snapshotTime: number;
  /** 20 有效 / 50 失效（LP_PREAUTH_STATUS_LABEL）。 */
  status: number;
  createTime: number;
}

export interface LpPreauthListFilter {
  lpId?: number;
  poolId?: number;
  tokenId?: number;
  status?: number;
}

export interface LpPreauthListReq {
  pageNum: number;
  pageSize: number;
  filter: LpPreauthListFilter;
}

/** 预授权状态（源 index.vue STATUS_MAP 定稿英文）。 */
export const LP_PREAUTH_STATUS_LABEL: Record<number, string> = {
  20: 'Active',
  50: 'Invalid',
};

export const LP_PREAUTH_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
  50: 'outline',
};
