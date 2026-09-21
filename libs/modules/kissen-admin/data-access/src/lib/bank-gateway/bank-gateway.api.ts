import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-client';
import type { BankGatewayInfo, BankGatewayRegisterReq } from './bank-gateway.model';

/** 网关连接信息（连通性 + 端点 + 密钥指纹 + 最近心跳）。 */
export function getBankGatewayInfo(
  bankId: number,
  config?: AxiosRequestConfig,
): Promise<BankGatewayInfo> {
  return kissenRequest.get<BankGatewayInfo>(`/manage/bank-gateway/info/${bankId}`, config);
}

/**
 * 网关注册/更新（POST /manage/bank-gateway/register）。
 * keyFingerprint 空串/缺省 = 保持原值（已登记场景，裁决 C-6）；未登记必填报送。
 */
export function registerBankGateway(req: BankGatewayRegisterReq): Promise<void> {
  return kissenRequest.post('/manage/bank-gateway/register', req);
}

/**
 * 测试连接：对已保存 endpointUrl 探活（超时 3s）。
 * 后端更新 connectivity_status 与 last_heartbeat_time（M14 S10）。
 */
export function testBankGateway(bankId: number): Promise<void> {
  return kissenRequest.post(`/manage/bank-gateway/test/${bankId}`);
}
