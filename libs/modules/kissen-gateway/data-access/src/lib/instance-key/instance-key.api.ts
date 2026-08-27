/**
 * 实例密钥域 raw API 层（源 `api/instance-key.ts`，四端点）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type {
  InstanceKeyView,
  KeyPrivateDownloadReq,
  KeyResetReq,
} from './instance-key.model';

/** 实例密钥视图（GET /instance/key/view，双凭证状态总览）。 */
export function getInstanceKeyView(
  config?: AxiosRequestConfig,
): Promise<InstanceKeyView> {
  return kissenRequest.get<InstanceKeyView>('/instance/key/view', config);
}

/** 公钥下载（GET /instance/key/public/download，返回 PEM 文本）。 */
export function downloadPublicKey(
  config?: AxiosRequestConfig,
): Promise<string> {
  return kissenRequest.get<string>('/instance/key/public/download', config);
}

/** 私钥下载（POST /instance/key/private/download，口令二次确认；@OperateLog 留痕但参数不落日志）。 */
export function downloadPrivateKey(
  data: KeyPrivateDownloadReq,
  config?: AxiosRequestConfig,
): Promise<string> {
  return kissenRequest.post<string>('/instance/key/private/download', data, config);
}

/** 密钥重置（POST /instance/key/reset；upstream=本地重新生成并重推 / downstream=管理侧重新生成并下发）。 */
export function resetInstanceKey(
  data: KeyResetReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/instance/key/reset', data, config);
}
