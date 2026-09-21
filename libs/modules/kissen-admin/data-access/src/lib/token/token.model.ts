/**
 * Token 管理域模型（源 `api/token.ts`；rowKey=tokenId）。
 *
 * 管理端只做审核/治理（approve/reject/调整流动性/停启用），无新增/编辑：
 * Token 由银行侧申报产生（源 views/onboard/token/index.vue 无新增按钮）。
 */

export interface TokenRow {
  tokenId: number;
  tokenNo: string;
  tokenCode: string;
  // GW-16 双码已退役（commit 6026e51/c3840b3）：tokenCode 即货币系统唯一标识，
  // 后端 list 不再返回 csTokenCode，本模型不再保留该字段。
  tokenName: string;
  symbol: string;
  decimalDigits: number;
  chainType: string;
  anchorFiat: string;
  minLiquidity: string | number;
  contractAddress: string;
  issuerDesc: string;
  bankId: number;
  bankCode: string;
  bankName: string;
  instanceId: number;
  instanceCode: string;
  status: number;
  /** 驳回原因（后端 rejectReason；status=15 时行内 tooltip 展示）。 */
  rejectReason: string;
  auditTime: number;
  createTime: number;
}

/** 列表过滤（POST /manage/token/list body 直传，返回裸数组无分页）。 */
export interface TokenListFilter {
  bankId?: number;
  instanceId?: number;
  tokenName?: string;
  tokenCode?: string;
  /** 页面展示为 Blockchain；Kissen token 接口的实际字段名为 chainType。 */
  chainType?: string;
  status?: number;
}

/** 审核通过请求；成功返回服务端分配的 tokenNo（全网唯一，终身不变）。 */
export interface TokenApproveReq {
  tokenId: number;
  minLiquidity?: string | number;
}

/** 驳回请求；原因必填（≤200 字符，银行侧可见）。 */
export interface TokenRejectReq {
  tokenId: number;
  reason: string;
}

/** Token 状态英文定稿（5/15 沿用 constraints.md 术语表；20/50 本域新定稿）。 */
export const TOKEN_STATUS_LABEL: Record<number, string> = {
  5: 'Pending Review',
  15: 'Rejected',
  20: 'Active',
  50: 'Disabled',
};

/**
 * 状态 → Badge variant（源 el-tag 色 success/warning/danger/info 映射：
 * success→default、warning→secondary、danger→destructive、info→outline，
 * 与 token-pair PAIR_STATUS_VARIANT 同口径）。
 */
export const TOKEN_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
  5: 'secondary',
  15: 'destructive',
  50: 'outline',
};
