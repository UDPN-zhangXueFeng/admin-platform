/**
 * 入网申请域 raw API 层（源 `api/onboard.ts` + `api/bank.ts`）。
 *
 * `GET /bank/info`（源 `api/bank.ts`）消费方：入网页内嵌 BankInfoCard 与
 * 独立页 /bank/info（O-8 终裁迁移，见 feature bank-pages.tsx），调用落在本域。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type { OnboardBankInfo, OnboardStatus, OnboardSubmitReq } from './onboard.model';

/** 当前入网状态（GET /onboard/status；尚无申请时后端返回 null）。 */
export function getOnboardStatus(
  config?: AxiosRequestConfig,
): Promise<OnboardStatus | null> {
  return kissenRequest.get<OnboardStatus | null>('/onboard/status', config);
}

/** 提交入网申请（POST /onboard/submit）。 */
export function submitOnboard(
  req: OnboardSubmitReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/onboard/submit', req, config);
}

/** 银行基本信息（GET /bank/info；由 Kissen 推送，无数据时返回 null）。 */
export function getOnboardBankInfo(
  config?: AxiosRequestConfig,
): Promise<OnboardBankInfo | null> {
  return kissenRequest.get<OnboardBankInfo | null>('/bank/info', config);
}
