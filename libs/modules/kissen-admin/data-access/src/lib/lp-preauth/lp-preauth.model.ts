/** LP 预授权（源 `api/lp-preauth.ts`；rowKey=preauthId，限定池的可扣减额度）。 */

export interface LpPreauthRow {
  preauthId: number;
  lpId: number;
  lpName: string;
  poolId: number;
  currency: string;
  /** 授权总额（BigDecimal）。 */
  authAmount: string | number;
  /** 已使用额度（BigDecimal）。 */
  usedAmount: string | number;
  /** 生效时间（后端 datetime：number 毫秒或 ISO string）。 */
  validFrom: string | number;
  /** 失效时间。 */
  validTo: string | number;
  /** 授权凭证（链上交易号 / 凭证串）。 */
  authCredential: string | null;
  /** 链上授权交易 ID。 */
  authCsTxId: string | null;
  status: number;
  createTime: number;
}

/** 与后端 LpPreauthSaveReqVO 对齐；preauthId 空=新增，非空=编辑。 */
export interface LpPreauthSaveReq {
  preauthId?: number;
  lpId: number;
  poolId: number;
  authAmount: string | number;
  /** datetime，提交前转 epoch 毫秒（源 preauth-form-dialog `validFrom.getTime()`）。 */
  validFrom: number;
  validTo: number;
  authCredential?: string;
  authCsTxId?: string;
}

export interface LpPreauthListFilter {
  lpId?: number;
  poolId?: number;
  currency?: string;
  status?: number;
}

export interface LpPreauthListReq {
  pageNum: number;
  pageSize: number;
  filter: LpPreauthListFilter;
}

/** 预授权状态（沿用 CommonStatusEnum；20 审核通过=生效可撤销，50 停用=已撤销）。 */
export const LP_PREAUTH_STATUS_LABEL: Record<number, string> = {
  1: 'Saved (Draft)',
  20: 'Approved',
  50: 'Disabled',
};

export const LP_PREAUTH_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'outline',
  20: 'default',
  50: 'outline',
};

