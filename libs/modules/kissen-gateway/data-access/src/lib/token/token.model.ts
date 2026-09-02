/**
 * Token 域模型（源 `types/token.ts` + `views/token/manage.vue` 状态映射）。
 *
 * status：5 待审核 / 20 已生效 / 15 已驳回 / 50 已停用（对齐 Kissen CommonStatusEnum）；
 * tokenType（协议扩展 P2 占位）：1=Stablecoin / 5=Tokenized Deposit / 20=Tokenized MMF。
 */

/** Badge variant 约定（kissen 家族语义分层，Element tag type 映射见各映射表注释）。 */
type TokenVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 本实例注册 token（gw_token_info，GW-06）。 */
export interface TokenInfo {
  tokenId: number;
  /** 全网唯一标识（32 位 hex UUID，审核通过后由 Kissen 分配；待审核时为空）。 */
  tokenNo?: string;
  /** token 编码（本实例内唯一；即货币系统 token code）。 */
  tokenCode: string;
  /** 货币系统标识 code（GW-16；本实例注册上传时与 tokenCode 同值，详情展示用）。 */
  csTokenCode?: string;
  /** token 归属（GW-17）：1 本行本实例 / 2 本行其他实例 / 3 其他行实例。 */
  tokenScope?: number;
  tokenName: string;
  symbol: string;
  /** 小数位数。 */
  decimalDigits: number;
  /** 区块链类型（ETH/BSC/TRON…）。 */
  chainType: string;
  /** 锚定法币（ISO 4217，如 USD/CNY）。 */
  anchorFiat: string;
  /** 最低流动性（审核通过时 Kissen 赋默认值）。 */
  minLiquidity?: number;
  /** token 类型（协议扩展 P2 占位）：1=Stablecoin/5=Tokenized Deposit/20=Tokenized MMF；Kissen 下发前为空。 */
  tokenType?: number;
  status: number;
  /** 驳回原因（可修改后重提）。 */
  rejectReason?: string;
  version?: number;
  pushTime?: number;
}

/** token 注册/重提请求（POST /token/submit，G-12 上行）；tokenCode 即货币系统 token code。 */
export interface TokenSubmitReq {
  tokenCode: string;
  tokenName: string;
  symbol: string;
  decimalDigits: number;
  chainType: string;
  anchorFiat: string;
  contractAddress?: string;
  issuerDesc?: string;
  remark?: string;
}

/** token 提交响应。idempotent=true 表示本地已有同 tokenCode 非驳回态申请，未重新上行直接返回原状态。 */
export interface TokenSubmitResp {
  tokenCode: string;
  status: number;
  idempotent: boolean;
  rejectReason?: string;
}

/**
 * token 状态（对齐 GET /token/list 下发，源 `views/token/manage.vue` TOKEN_STATUS）。
 * variant 分层映射：Element warning→secondary、success→default、danger→destructive、info→outline。
 */
export const TOKEN_STATUS: Record<number, { text: string; variant: TokenVariant }> = {
  5: { text: 'Pending Review', variant: 'secondary' },
  20: { text: 'Active', variant: 'default' },
  15: { text: 'Rejected', variant: 'destructive' },
  50: { text: 'Disabled', variant: 'outline' },
};

/** token 状态文案；null/undefined → '-'，未知码 → `Unknown(${status})`（源 statusText）。 */
export function tokenStatusText(status?: number): string {
  return status == null ? '-' : (TOKEN_STATUS[status]?.text ?? `Unknown (${status})`);
}

/** token 类型文案（协议扩展 P2 占位；源 TOKEN_TYPE_TEXT，1/5/20）。 */
export const TOKEN_TYPE_TEXT: Record<number, string> = {
  1: 'Stablecoin',
  5: 'Tokenized Deposit',
  20: 'Tokenized MMF',
};

/** token 类型；null/undefined → '-'，未知码 → `Unknown (n)`（源 tokenTypeText）。 */
export function tokenTypeText(type?: number): string {
  return type == null ? '-' : (TOKEN_TYPE_TEXT[type] ?? `Unknown (${type})`);
}

/**
 * token 归属（源 views/token/detail.vue SCOPE_TEXT，GW-17）：
 * 1 本行本实例 / 2 本行其他实例 / 3 其他行实例（英化文案，语义分层不变）。
 */
export const TOKEN_SCOPE_TEXT: Record<number, string> = {
  1: 'Own bank · this instance',
  2: 'Own bank · other instances',
  3: "Other banks' instance",
};

/** token 归属文案；null/undefined → '-'，未知码 → `Unknown (n)`（源 scopeText）。 */
export function tokenScopeText(scope?: number): string {
  return scope == null ? '-' : (TOKEN_SCOPE_TEXT[scope] ?? `Unknown (${scope})`);
}

/** token 状态 Badge variant；未知码降级 outline（源 statusType 的 info 兜底）。 */
export function tokenStatusVariant(status?: number): TokenVariant {
  return status == null ? 'outline' : (TOKEN_STATUS[status]?.variant ?? 'outline');
}
