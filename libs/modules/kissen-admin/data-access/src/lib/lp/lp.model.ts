/** LP 主数据模型（源 `api/lp.ts` LpRespVO；BigDecimal 序列化为 string|number）。 */

/** LP 列表行 / 详情（rowKey=lpId）。 */
export interface LpRow {
  lpId: number;
  lpName: string;
  lpCode: string;
  splitRatio: string | number;
  minLiquidity: string | number;
  riskAssessment: string | null;
  status: number;
  createTime: number;
  /** 初始参与货币对 ID 列表；仅 detail 接口填充，列表行可能为 null。 */
  initialPairIds: number[] | null;
}

/** 与后端 LpSaveReqVO 对齐；lpId 空=新建（草稿），非空=编辑。 */
export interface LpSaveReq {
  lpId?: number;
  lpName: string;
  lpCode: string;
  splitRatio: string | number;
  minLiquidity: string | number;
  riskAssessment?: string;
  initialPairIds?: number[];
}

export interface LpListFilter {
  lpName?: string;
  lpCode?: string;
  status?: number;
}

export interface LpListReq {
  pageNum: number;
  pageSize: number;
  filter: LpListFilter;
}

/**
 * LP 选项（表单 lpId 下拉数据源；跨组薄调用 POST /manage/lp/list 行子集）。
 * LP 各子域（pool/pair/preauth/topup）共用此类型，避免 barrel 重导出同名冲突。
 */
export interface LpOption {
  lpId: number;
  lpName: string;
  lpCode: string;
  status: number;
}

/**
 * 货币对选项（LP 表单 initialPairIds 多选数据源）。
 * 跨组薄调用 POST /manage/currency-pair/list 返回行子集（源 api/currency-pair.ts）。
 */
export interface CurrencyPairOption {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  status: number;
}

/** LP 入网/状态沿用 CommonStatusEnum（源 views/approval/status.ts COMMON_STATUS_MAP）。 */
export const LP_STATUS_LABEL: Record<number, string> = {
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

/** LP 状态 → Badge variant（conventions §5：成功/启用=default、失败=destructive、草稿/中性=outline）。 */
export const LP_STATUS_VARIANT: Record<
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

/** 冻结/解冻请求体（源 api/freeze.ts FreezeToggleReq；targetType=2 LP）。 */
export interface LpFreezeReq {
  targetType: number;
  targetId: number;
  freeze: boolean;
}

/** 冻结目标类型：1 银行 / 2 LP / 3 货币对（源 api/freeze.ts）。LP 用 2。 */
export const LP_FREEZE_TARGET_TYPE = 2;
