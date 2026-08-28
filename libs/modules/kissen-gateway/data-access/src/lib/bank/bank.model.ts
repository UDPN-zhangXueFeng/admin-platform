/**
 * 银行域模型（源 `types/business.ts` BankDetail/BankQueryItem/BankInfoSubmitReq|Resp/OnboardStatus +
 * `views/onboard/index.vue`/`views/instance-key/drawer.vue` 状态映射）。
 *
 * 入网语义：onboardStatus 0 未入网 / 5 待审核 / 15 已拒绝 / 20 已通过；
 * 实例 connectivity：UP / DOWN；credentialMode：instance / bootstrap / legacy。
 */

/** Badge variant 约定（kissen 家族语义分层，Element tag type 映射见各映射表注释）。 */
type BankVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 银行信息合一提交（POST /bank/info-submit；已入网分支复用 /bank/contact-update 同构）。 */
export interface BankInfoSubmitReq {
  agreeConfirmed?: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  contactAddress?: string;
  agreementVersion?: string;
}

/** 合一提交响应。result：ONBOARD_SUBMITTED=已创建入网申请（附 applyId）/ INFO_UPDATED=已入网仅更新联系人。 */
export interface BankInfoSubmitResp {
  result: 'ONBOARD_SUBMITTED' | 'INFO_UPDATED' | string;
  applyId?: number;
}

/** 入网申请状态（GET /bank/onboard/status）。status：5 待审核 / 15 拒绝 / 20 通过；尚无申请时字段为空。 */
export interface OnboardStatus {
  applyId?: number;
  status?: number;
  approveFeedback?: string;
  agreeTime?: number;
}

/** 本行 Gateway 实例条目（bank/detail 派生）。 */
export interface InstanceItem {
  instanceId: string;
  /** connectivity：UP / DOWN。 */
  connectivity: string;
  activated: boolean;
  /** credentialMode：instance / bootstrap / legacy。 */
  credentialMode: string;
}

/** 银行信息详情（GET /bank/detail，GW-17 纯本地化：本行库组装，不再实时上行；新鲜度靠 G-14 推送/入网查询回写）。 */
export interface BankDetail {
  bankCode: string;
  bankName: string;
  bic: string;
  /** 本机 Gateway 实例编码（与 instances[].instanceId 匹配判定激活状态）。 */
  instanceId?: string;
  /** onboardStatus：0 未入网 / 5 待审核 / 15 已拒绝 / 20 已通过。 */
  onboardStatus: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactAddress?: string;
  /** 货币系统对接说明（管理侧登记；GW-17 本地化后网关无存储列，下发前保持空）。 */
  csDesc?: string;
  /** 货币系统类型（GW-16 重构值域）：0 未填/1 区块链/2 传统/3 其他。 */
  currencySystemType?: number;
  /** 货币系统名称（GW-16）。 */
  currencySystemName?: string;
  /** 可交易 token 摘要 JSON 串（gw_bank_info.tokenList）。 */
  tokenList?: string;
  /** GW-17 纯本地化后降级路径消亡；字段保留协议兼容。 */
  degraded: boolean;
  lastSyncTime?: number;
  instances: InstanceItem[];
}

/** 可交易 token 摘要（gw_bank_info.tokenList JSON 数组元素，GW-11 token 化替代 supportedCurrencies）。 */
export interface BankTokenItem {
  tokenNo?: string;
  tokenCode: string;
  tokenName?: string;
  symbol?: string;
  chainType?: string;
  anchorFiat?: string;
}

/** 银行信息推送缓存（GET /bank/info，源 types/business.ts `BankInfo`；无数据时返回 null）。
 *  onboard 页兜底展示 bankId（详情报文暂缺，协议扩展 P1）。 */
export interface BankInfo {
  infoId?: number;
  bankId?: number;
  bankName: string;
  bankCode: string;
  bic: string;
  tokenList: string;
  accountConfig: string;
  status: number;
  version?: number;
  pushTime?: number;
}

/** 网络银行列表项（GET /bank/query/list，gw_bank_info 权限可见集合投影）。
 *  Official Website / Description / Registration Time 为协议扩展依赖（P1），下发前前端占位 '-'。 */
export interface BankQueryItem {
  bankId?: number;
  /** 是否本行（03716c8 新增：后端按 kissen.bank-code 比对下发；未下发按外部银行）。 */
  self?: boolean;
  bankName?: string;
  bankCode?: string;
  bic?: string;
  /** 货币系统类型（GW-16 重构值域）：0 未填/1 区块链/2 传统/3 其他。 */
  currencySystemType?: number;
  /** 货币系统名称（GW-16）。 */
  currencySystemName?: string;
  /** 可交易 token 摘要 JSON 串（BankTokenItem[]）。 */
  tokenList?: string;
  pushTime?: number;
}

/**
 * 入网/银行状态（源 `views/onboard/index.vue` ONBOARD_STATUS，含 0 未入网态）。
 * variant 分层映射：Element info→outline、warning→secondary、danger→destructive、success→default。
 */
export const BANK_ONBOARD_STATUS: Record<number, { text: string; variant: BankVariant }> = {
  0: { text: 'Not Onboarded', variant: 'outline' },
  5: { text: 'Pending Review', variant: 'secondary' },
  15: { text: 'Rejected', variant: 'destructive' },
  20: { text: 'Approved', variant: 'default' },
};

/** 入网/银行状态文案；null/undefined → '-'，未知码 → `Unknown(${status})`（源 onboardText）。 */
export function onboardStatusText(status?: number): string {
  return status == null ? '-' : (BANK_ONBOARD_STATUS[status]?.text ?? `Unknown (${status})`);
}

/** 入网/银行状态 Badge variant；未知码降级 outline（源 onboardType 的 info 兜底）。 */
export function onboardStatusVariant(status?: number): BankVariant {
  return status == null ? 'outline' : (BANK_ONBOARD_STATUS[status]?.variant ?? 'outline');
}

/** 实例连通状态文案；UP/DOWN 原样展示，其余 '-'（源 onboard 模板直接输出 UP/DOWN）。 */
export function instanceConnectivityText(connectivity?: string): string {
  return connectivity === 'UP' || connectivity === 'DOWN' ? connectivity : '-';
}

/** 实例连通状态 Badge variant：UP→default(success) / DOWN→destructive(danger)，未知降级 outline（源 onboard 模板）。 */
export function instanceConnectivityVariant(connectivity?: string): BankVariant {
  return connectivity === 'UP' ? 'default' : connectivity === 'DOWN' ? 'destructive' : 'outline';
}

/** 实例凭证模式文案；原样展示（instance/bootstrap/legacy），空值 '-'（源 onboard 模板 `row.credentialMode || '-'`）。 */
export function instanceCredentialModeText(mode?: string): string {
  return mode ?? '-';
}
