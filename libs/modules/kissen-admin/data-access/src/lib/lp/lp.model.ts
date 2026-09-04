/** LP 主数据模型（源 `api/lp.ts` LpRespVO；BigDecimal 序列化为 string|number）。 */

/**
 * LP 列表行 / 详情（rowKey=lpId）。
 *
 * v2.0 tokenization：LP 级 splitRatio/minLiquidity 已删除——分成挂在 LP×token 对
 * （lp-pair 域），最低流动性挂在 token 级；新增 contact 三件套 + settleCycle。
 */
export interface LpRow {
  lpId: number;
  lpName: string;
  /** 联系人（源 2026-08-27 FR-LP-01 补充）。 */
  contactName: string;
  /** 联系邮箱。 */
  contactEmail: string;
  /** 地址。 */
  address: string;
  lpCode: string;
  /** 结算周期：1 日结 / 2 周结 / 3 月结（见 SETTLE_CYCLE_MAP）。 */
  settleCycle: number;
  riskAssessment: string | null;
  status: number;
  createTime: number;
}

/** 与后端 LpSaveReqVO 对齐；lpId 空=新建（草稿），非空=编辑。 */
export interface LpSaveReq {
  lpId?: number;
  lpName: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  lpCode: string;
  /** 入网表单不设置（默认月结）；调整移至结算周期配置页（源 2026-08-27）。 */
  settleCycle?: number;
  riskAssessment?: string;
  /** v2 表单已不传，仅接口层保留（源 LpSaveReq 同名可选字段）。 */
  initialPairIds?: number[];
}

export interface LpListFilter {
  lpName?: string;
  lpCode?: string;
  /** 按结算周期筛选：1 日结 / 2 周结 / 3 月结。 */
  settleCycle?: number;
  status?: number;
  /** true=进行中/未通过（非 20），由 LP 入网相关页面使用。 */
  notApproved?: boolean;
}

export interface LpListReq {
  pageNum: number;
  pageSize: number;
  filter: LpListFilter;
}

/**
 * LP 选项（表单/筛选 lpId 下拉数据源；跨组薄调用 POST /manage/lp/list 行子集）。
 * LP 各子域（pool/pair）共用此类型，避免 barrel 重导出同名冲突。
 */
export interface LpOption {
  lpId: number;
  lpName: string;
  lpCode: string;
  status: number;
}

/** 结算周期文案（源 api/lp.ts SETTLE_CYCLE_MAP；上游中文定稿英文）。 */
export const SETTLE_CYCLE_MAP: Record<number, string> = {
  1: 'Daily',
  2: 'Weekly',
  3: 'Monthly',
};

/** LP 入网/状态沿用 CommonStatusEnum（源 views/approval/status.ts COMMON_STATUS_MAP 定稿英文）。 */
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

/** LP 状态 → Badge variant（success=default、danger=destructive、warning=secondary、info/中性=outline）。 */
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

/** LP 门户账号状态（源 api/lp.ts PortalAccountStatus；KLO 审批通过自动开户，此为查询入口）。 */
export interface PortalAccountStatus {
  provisioned: boolean;
  loginName: string;
  status: number;
}

/** 门户首管理员口令重置结果（源 api/lp.ts PortalAccountReset；OTP 一次性返回）。 */
export interface PortalAccountReset {
  loginName: string;
  lpCode: string;
  oneTimePassword: string;
}
