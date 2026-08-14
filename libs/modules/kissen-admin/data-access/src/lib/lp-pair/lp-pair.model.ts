/** LP 参与货币对（源 `api/lp-pair.ts`；rowKey=id，为 LP 下挂货币对关系记录）。 */

export interface LpPairRow {
  id: number;
  lpId: number;
  lpName: string;
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  status: number;
  remark: string | null;
  approvalRecordId: number | null;
  createTime: number;
}

/** 与后端 LpCurrencyPairSaveReqVO 对齐；id 空=新增，非空=编辑。 */
export interface LpPairSaveReq {
  id?: number;
  lpId: number;
  pairId: number;
  remark?: string;
}

export interface LpPairListFilter {
  lpId?: number;
  pairId?: number;
  status?: number;
}

export interface LpPairListReq {
  pageNum: number;
  pageSize: number;
  filter: LpPairListFilter;
}

/**
 * 状态操作目标值（源 api/lp-pair.ts lpPairStatus targetStatus）。
 * 50=停用（active→stopped），1=恢复草稿（stopped→draft）。
 */
export const LP_PAIR_TARGET_STATUS = {
  /** 恢复为草稿（status 50 → 1）。 */
  restore: 1,
  /** 停用（active → 50）。 */
  disable: 50,
} as const;

/** LP 货币对状态沿用 CommonStatusEnum。 */
export const LP_PAIR_STATUS_LABEL: Record<number, string> = {
  1: '草稿',
  3: '撤回',
  5: '待审核',
  10: '审核中',
  15: '审核拒绝',
  20: '正常',
  25: '已签名',
  30: '提交中',
  35: '最终确认',
  40: '提交失败',
  45: '删除',
  50: '停用',
};

export const LP_PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'outline',
  3: 'secondary',
  5: 'secondary',
  10: 'secondary',
  15: 'destructive',
  20: 'default',
  25: 'default',
  30: 'secondary',
  35: 'default',
  40: 'destructive',
  45: 'outline',
  50: 'outline',
};

