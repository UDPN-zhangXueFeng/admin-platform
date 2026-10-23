/**
 * Bank-interact domain raw API layer (source `api/bank-interact.ts`).
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-client';
import type { InteractSaveReq, InteractViewReq, InteractViewResult } from './bank-interact.model';

/** Peer list for one bank (POST /manage/bank-interact/view). */
export function interactView(
  req: InteractViewReq,
  config?: AxiosRequestConfig,
): Promise<InteractViewResult> {
  return kissenRequest.post<InteractViewResult>('/manage/bank-interact/view', req, config);
}

/**
 * 保存交互规则的超时（毫秒）。
 *
 * 后端保存后会立即把规则推送到各网关，实测一次保存耗时约 15.3s；kissen 客户端
 * 默认 `timeout: 15000` 会正好在这一刻中断请求——后端已落库，但前端收不到成功
 * 回执（表现为「Network timeout」+ 开关不生效）。该端点单独放宽到 60s。
 */
const INTERACT_SAVE_TIMEOUT_MS = 60_000;

/** Toggle one rule (POST /manage/bank-interact/save; pushes to gateways immediately). */
export function interactSave(
  req: InteractSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/bank-interact/save', req, {
    timeout: INTERACT_SAVE_TIMEOUT_MS,
    ...config,
  });
}
