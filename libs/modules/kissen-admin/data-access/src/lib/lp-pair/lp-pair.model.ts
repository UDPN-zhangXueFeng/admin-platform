/**
 * LP×Token 对参与关系（源 `api/lp-pair.ts` LpPairRespVO；rowKey=id）。
 *
 * v2.0：lp_token_pair 联查 token_pair/token_info/bank_info——
 * sourceCurrency/targetCurrency 值为 tokenCode，新增 pairCode/双方银行名/splitRatio。
 */

export interface LpPairRow {
  id: number;
  lpId: number;
  lpName: string;
  pairId: number;
  pairCode: string;
  /** 汇率两字段（2026-08-31 并入展示；用户汇率=base÷(1+markup) 前端派生；旧数据可缺失，markup 可为 null）。 */
  baseRate?: string | number | null;
  markupRate?: string | number | null;
  /** 双侧激活池地址（多池模型 2026-09-01：收=源侧/付=解付出款；旧数据可缺失）。 */
  sourcePoolAddress?: string;
  targetPoolAddress?: string;
  /** 值为 tokenCode（v2 token 化）。 */
  sourceCurrency: string;
  /** 值为 tokenCode（v2 token 化）。 */
  targetCurrency: string;
  /** 源端/目标端银行名称（紧凑三行单元格副行）。 */
  sourceBankName: string;
  targetBankName: string;
  /** Override split ratio (0–1 decimal; 0 = not set, falls back to the token pair default). */
  splitRatio: string | number;
  /** Count of pending KLS override-split change requests (>0 blocks editing; source 2023418). */
  pendingSplit: number;
  status: number;
  remark: string;
  approvalRecordId: number;
  createTime: number;
}

/** 与后端 LpPairSaveReqVO 对齐；id 空=新建草稿，非空=编辑（仅 1/15 可编辑，lpId/pairId 不可改）。 */
export interface LpPairSaveReq {
  id?: number;
  lpId: number;
  pairId: number;
  /** 覆盖分成比例。 */
  splitRatio?: string | number;
  remark?: string;
}

export interface LpPairListFilter {
  lpId?: number;
  pairId?: number;
  status?: number;
  /** true=进行中/未通过（非 20）；Tab「In Progress / Rejected」用。 */
  notApproved?: boolean;
}

export interface LpPairListReq {
  pageNum: number;
  pageSize: number;
  filter: LpPairListFilter;
}

/**
 * 状态操作目标值（源 api/lp-pair.ts lpPairStatus targetStatus）。
 * 50=停用（仅 20 可停）；1=恢复为草稿（仅 50 可恢复）。
 */
export const LP_PAIR_TARGET_STATUS = {
  /** 恢复为草稿（status 50 → 1）。 */
  restore: 1,
  /** 停用（status 20 → 50）。 */
  disable: 50,
} as const;

/** LP×Token 对状态沿用 CommonStatusEnum（源 views/approval/status.ts 定稿英文）。 */
export const LP_PAIR_STATUS_LABEL: Record<number, string> = {
  1: 'Saved (Draft)',
  3: 'Withdrawn',
  5: 'Pending Review',
  10: 'Under Review',
  15: 'Rejected',
  20: 'Approved',
  25: 'Signed',
  30: 'Submitting',
  35: 'Final Confirmation',
  40: 'Submission Failed',
  45: 'Deleted',
  50: 'Disabled',
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

/** Token 对选项（pairId 筛选下拉；薄调用 POST /manage/token-pair/list 行子集，命名加前缀防 barrel 冲突）。 */
export interface LpPairTokenPairOption {
  pairId: number;
  pairCode: string;
  sourceTokenCode: string;
  targetTokenCode: string;
  status: number;
}
