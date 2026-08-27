/**
 * bank 域 raw API 层（源 `api/bank.ts`，对齐 HEAD 端点清单）。
 *
 * 与 onboard 域并存：onboard 域保留旧 `GET /onboard/status`（T13 前兼容），
 * 本域为 HEAD 语义终点（GET /bank/detail、POST /bank/info-submit 等）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type {
  BankDetail,
  BankInfoSubmitReq,
  BankInfoSubmitResp,
  BankQueryItem,
  OnboardStatus,
} from './bank.model';

/** 银行信息详情（GET /bank/detail，实时上行 Kissen；失败降级本地缓存并置 degraded=true）。 */
export function getBankDetail(config?: AxiosRequestConfig): Promise<BankDetail> {
  return kissenRequest.get<BankDetail>('/bank/detail', config);
}

/** 银行信息合一提交（POST /bank/info-submit；未入网=入网申请 / 已入网=联系人更新，由 Kissen 分流）。 */
export function infoSubmit(
  data: BankInfoSubmitReq,
  config?: AxiosRequestConfig,
): Promise<BankInfoSubmitResp> {
  return kissenRequest.post<BankInfoSubmitResp>('/bank/info-submit', data, config);
}

/** 联系人就地编辑（POST /bank/contact-update；与 info-submit 同构，已入网分支的专用入口）。 */
export function contactUpdate(
  data: BankInfoSubmitReq,
  config?: AxiosRequestConfig,
): Promise<BankInfoSubmitResp> {
  return kissenRequest.post<BankInfoSubmitResp>('/bank/contact-update', data, config);
}

/** 入网申请状态（GET /bank/onboard/status，上行 Kissen 兜底并回写本地）。 */
export function getBankOnboardStatus(
  config?: AxiosRequestConfig,
): Promise<OnboardStatus> {
  return kissenRequest.get<OnboardStatus>('/bank/onboard/status', config);
}

/** 网络银行列表（GET /bank/query/list，GW-14 UDPN 对齐：gw_bank_info 权限可见集合）。 */
export function bankQueryList(
  config?: AxiosRequestConfig,
): Promise<BankQueryItem[]> {
  return kissenRequest.get<BankQueryItem[]>('/bank/query/list', config);
}
