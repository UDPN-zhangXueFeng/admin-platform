/**
 * 实例引导域 raw API 层（源 `api/bootstrap.ts`）。
 *
 * 独立免 token 实例（baseURL `/kissen-api/bankgw/bootstrap`，AuthFilter 白名单
 * /bankgw/bootstrap/**）；响应同为 ResultInfo，但仅解包不跳登录（引导期无会话语义）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenBootstrapRequest } from '../kissen-gateway-client';
import type { BootstrapState, PushKeyResp } from './bootstrap.model';

/** 引导状态（GET /state；入网信息页激活流程轮询）。 */
export function getBootstrapState(
  config?: AxiosRequestConfig,
): Promise<BootstrapState> {
  return kissenBootstrapRequest.get<BootstrapState>('/state', config);
}

/** 上行公钥推送（POST /public-key/push；G-13「激活」按钮唯一入口，失败可重复触发重试，幂等）。 */
export function pushPublicKey(
  config?: AxiosRequestConfig,
): Promise<PushKeyResp> {
  return kissenBootstrapRequest.post<PushKeyResp>(
    '/public-key/push',
    undefined,
    config,
  );
}
