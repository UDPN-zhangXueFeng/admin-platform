/** LP 补资/充值（源 `api/lp-topup.ts`；rowKey=topupId，LP 向资金池注入资金）。 */

export interface LpTopupRow {
  topupId: number;
  lpId: number;
  lpName: string;
  poolId: number;
  currency: string;
  amount: string | number;
  transferInAddress: string;
  declareTime: number | null;
  confirmTime: number | null;
  csTxId: string | null;
  /** 1=已声明 2=已到账 3=失败（源 api/lp-topup.ts）。 */
  status: number;
  createTime: number;
}

/** 声明补资请求（lpId/poolId/amount/transferInAddress；源 topup-dialog create）。 */
export interface LpTopupSaveReq {
  lpId: number;
  poolId: number;
  amount: string | number;
  transferInAddress?: string;
}

export interface LpTopupListFilter {
  lpId?: number;
  currency?: string;
  status?: number;
}

export interface LpTopupListReq {
  pageNum: number;
  pageSize: number;
  filter: LpTopupListFilter;
}

/** 补资状态（源 api/lp-topup.ts status）。 */
export const LP_TOPUP_STATUS_LABEL: Record<number, string> = {
  1: 'Declared',
  2: 'Credited',
  3: 'Failed',
};

export const LP_TOPUP_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'secondary',
  2: 'default',
  3: 'destructive',
};

