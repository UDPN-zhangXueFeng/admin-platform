/**
 * LP 资金池（源 `api/lp-pool.ts` LpPoolRespVO；rowKey=poolId）。
 *
 * v2.0 token 化：tokenId/tokenCode/tokenNo 替代 currency；最低流动性不在本表登记
 * （水位分母=token 级 minLiquidity，决策 D2）；预授权快照联查字段
 * （authAmount/preauthAvailable/preauthSnapshotTime，availableAmount 口径，无凭证字段）。
 */

export interface LpPoolRow {
  poolId: number;
  lpId: number;
  lpName: string;
  /** v2.0 token 维度（currency 列已废弃）。 */
  tokenId: number;
  tokenCode: string;
  tokenNo: string;
  /** token 级最低流动性（水位分母，联查 token_info.min_liquidity；缺失/≤0 时水位整列 '-'）。 */
  minLiquidity: string | number;
  accountAddress: string;
  /** 货币系统形态：1 链上 EVM / 2 Aptos / 3 内部系统。 */
  currencySystemType: number;
  /** 低水位提醒阈值（0~1 比率）。 */
  remindThreshold: string | number;
  /** 可用余额快照。 */
  availableBalanceCache: string | number;
  /** 余额快照时间（毫秒）。 */
  balanceUpdateTime: number;
  /** 预授权快照联查（最新一条；null=未设置）。 */
  authAmount: string | number | null;
  /** 可用授权（接口 2 查询值，非前端差值；null=未设置）。 */
  preauthAvailable: string | number | null;
  /** 预授权有效期至（毫秒；页面未展示）。 */
  preauthValidTo: number | null;
  /** 预授权快照时间（毫秒；页面未展示时无副行）。 */
  preauthSnapshotTime: number | null;
  status: number;
  createTime: number;
}

/**
 * 发行银行名称（源 index.vue 直接渲染 row.tokenBankName，而源 api interface 未声明——
 * 后端联查返回，本模型显式补充以防误判缺字段）。
 */
export interface LpPoolRowWithBank extends LpPoolRow {
  tokenBankName?: string | null;
}

/** 与后端 LpPoolSaveReqVO 对齐；poolId 空=开通（审批通过落地/管理侧直开），非空=编辑（lpId/tokenId 不可改）。 */
export interface LpPoolSaveReq {
  poolId?: number;
  lpId: number;
  tokenId: number;
  accountAddress: string;
  currencySystemType?: number;
  approvalRecordId?: number;
  remindThreshold: string | number;
}

export interface LpPoolListFilter {
  lpId?: number;
  tokenId?: number;
  status?: number;
}

export interface LpPoolListReq {
  pageNum: number;
  pageSize: number;
  filter: LpPoolListFilter;
}

/**
 * 资金池状态（监控视图值域 5/15/20/50；源 index.vue POOL_STATUS_MAP 定稿英文）。
 */
export const LP_POOL_STATUS_LABEL: Record<number, string> = {
  5: 'Applying',
  15: 'Rejected',
  20: 'Active',
  50: 'Disabled',
};

export const LP_POOL_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'secondary',
  15: 'destructive',
  20: 'default',
  50: 'outline',
};

/** 货币系统形态（源 api/lp-pool.ts currencySystemType）。 */
export const CURRENCY_SYSTEM_TYPE_LABEL: Record<number, string> = {
  1: 'EVM',
  2: 'Aptos',
  3: 'Internal',
};
