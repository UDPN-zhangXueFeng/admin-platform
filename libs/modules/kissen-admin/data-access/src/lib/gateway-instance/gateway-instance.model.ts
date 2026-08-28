/**
 * 网关实例域模型（源 `api/gateway-instance.ts`；rowKey=instanceId）。
 *
 * v2.0 实例维度新域：同一银行可登记多实例（prod/dr）。与 v1 银行级
 * bank-gateway 域并存（register 端点同路径、body 不同）。
 */

export interface InstanceRow {
  instanceId: number;
  bankId: number;
  bankCode: string;
  bankName: string;
  instanceCode: string;
  instanceName: string;
  endpointUrl: string;
  upKeyFingerprint: string;
  downKeyFingerprint: string;
  connectivityStatus: number;
  lastHeartbeatTime: number;
  lastVerifyTime: number;
  status: number;
  createTime: number;
}

/** 列表过滤（body 扁平直传 {pageNum,pageSize,bankId?,status?}，非 DataTable 包装）。 */
export interface InstanceListFilter {
  bankId?: number;
  status?: number;
}

export interface InstanceListReq {
  pageNum: number;
  pageSize: number;
  filter: InstanceListFilter;
}

/**
 * 实例登记请求（POST /manage/bank-gateway/register）。
 * 与 v1 bankGatewayRegister 同路径不同 body：v1 是 {bankId,endpointUrl,keyFingerprint}。
 */
export interface InstanceRegisterReq {
  bankId: number;
  instanceCode?: string;
  instanceName?: string;
  endpointUrl: string;
}

/** 联通验证结果（探活→生成下行密钥对→激活；DEC-01 流程）。 */
export interface InstanceVerifyResult {
  instanceId: number;
  status: number;
  downKeyFingerprint: string;
  connectivityStatus: number;
}

/** 心跳探测记录（GET /manage/bank-gateway/heartbeat/{instanceId}）。 */
export interface HeartbeatRow {
  logId: number;
  ok: number;
  mode: string;
  latencyMs: number;
  detail: string;
  probeTime: number;
}

/** 心跳分页响应（裸 {rows,total}，非 PageResult.page 包装）。 */
export interface HeartbeatPage {
  rows: HeartbeatRow[];
  total: number;
}

/** 实例状态英文定稿（1=登记未验证 / 10=公钥已推送可激活 / 20=激活 / 50=停用）。 */
export const INSTANCE_STATUS_LABEL: Record<number, string> = {
  1: 'Registered (Unverified)',
  10: 'Pubkey Pushed (Activatable)',
  20: 'Active',
  50: 'Disabled',
};

/**
 * 状态 → Badge variant（源 el-tag 色映射：success→default、warning→secondary、
 * info→outline；上游 1 与 50 同为 info，映射后同为 outline 保真）。
 */
export const INSTANCE_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'outline'
> = {
  20: 'default',
  10: 'secondary',
  1: 'outline',
  50: 'outline',
};
