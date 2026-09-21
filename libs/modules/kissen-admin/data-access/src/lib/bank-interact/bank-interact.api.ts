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

/** Toggle one rule (POST /manage/bank-interact/save; pushes to gateways immediately). */
export function interactSave(
  req: InteractSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/bank-interact/save', req, config);
}
