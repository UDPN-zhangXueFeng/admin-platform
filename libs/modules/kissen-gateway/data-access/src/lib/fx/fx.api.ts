/**
 * 汇率查询聚合域 raw API 层（源 `api/fx.ts`）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type { FxViewResp } from './fx.model';

/** 汇率查询聚合（GET /fx/view，GW-14 UDPN 对齐：token 对 + LP 名称 + 最新汇率一页融合）。 */
export function getFxView(config?: AxiosRequestConfig): Promise<FxViewResp> {
  return kissenRequest.get<FxViewResp>('/fx/view', config);
}
