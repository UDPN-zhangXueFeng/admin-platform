/**
 * bank-gateway 域模型（源 `api/bank-gateway.ts`）。
 *
 * 网关实例连通性（0 未知 / 1 正常 / 2 断开）与 tag 映射为银行列表与连接信息弹窗共用。
 */
import type { BankBadgeVariant } from '../bank/bank.model';

/** 与后端 BankGatewayInfoRespVO 对齐；未登记 registered=false，其余字段为空/0。 */
export interface BankGatewayInfo {
  bankId?: number;
  registered: boolean;
  endpointUrl: string;
  keyFingerprintMasked: string;
  connectivityStatus: number;
  lastHeartbeatTime: number;
}

/** 网关注册/更新请求；keyFingerprint 空串/缺省 = 保持原值（已登记场景，裁决 C-6）。 */
export interface BankGatewayRegisterReq {
  bankId: number;
  endpointUrl: string;
  keyFingerprint?: string;
}

/** 网关连通性中文映射（源 CONNECTIVITY_STATUS_MAP）。 */
export const CONNECTIVITY_STATUS_LABEL: Record<number, string> = {
  0: '未知',
  1: '正常',
  2: '断开',
};

/**
 * 网关连通性 → Badge variant（源 CONNECTIVITY_TAG_TYPE 的 info/success/danger
 * 映射：info→secondary、success→default、danger→destructive）。
 */
export const CONNECTIVITY_STATUS_VARIANT: Record<number, BankBadgeVariant> = {
  0: 'secondary',
  1: 'default',
  2: 'destructive',
};

/** 网关连接表单值。 */
export interface BankGatewayFormValues {
  endpointUrl: string;
  keyFingerprint: string;
}
