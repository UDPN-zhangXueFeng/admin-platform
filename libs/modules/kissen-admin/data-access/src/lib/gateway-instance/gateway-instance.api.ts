import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenRequest, type KissenPageResult } from '../kissen-client';
import type {
  HeartbeatPage,
  InstanceListReq,
  InstanceRegisterReq,
  InstanceRow,
  InstanceVerifyResult,
} from './gateway-instance.model';

/**
 * 实例分页列表（POST /manage/bank-gateway/list）。
 * 注意：body 为扁平 {pageNum,pageSize,bankId?,status?}，非 DataTable {page,data} 包装，
 * 不能走 kissenPage；此处手工转 PaginatedResponse。
 */
export async function instanceList(
  req: InstanceListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<InstanceRow>> {
  const raw = await kissenRequest.post<KissenPageResult<InstanceRow>>(
    '/manage/bank-gateway/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, ...req.filter },
    config,
  );
  const total = raw?.page?.total ?? 0;
  return {
    code: 0,
    message: 'ok',
    data: raw?.rows ?? [],
    pagination: {
      page: req.pageNum,
      pageSize: req.pageSize,
      total,
      totalPages:
        req.pageSize > 0 ? Math.max(1, Math.ceil(total / req.pageSize)) : 1,
    },
  };
}

/** 登记实例（POST /manage/bank-gateway/register；成功后 status=1，需 verify 才激活）。 */
export function instanceRegister(
  req: InstanceRegisterReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/bank-gateway/register', req, config);
}

/** 联通验证并激活（POST /manage/bank-gateway/verify/{instanceId}）。 */
export function instanceVerify(
  instanceId: number,
  config?: AxiosRequestConfig,
): Promise<InstanceVerifyResult> {
  return kissenRequest.post<InstanceVerifyResult>(
    `/manage/bank-gateway/verify/${instanceId}`,
    undefined,
    config,
  );
}

/** 重置下行密钥（POST /manage/bank-gateway/reset-key/{instanceId}；返回新指纹）。 */
export function instanceResetKey(
  instanceId: number,
  config?: AxiosRequestConfig,
): Promise<{ downKeyFingerprint: string }> {
  return kissenRequest.post<{ downKeyFingerprint: string }>(
    `/manage/bank-gateway/reset-key/${instanceId}`,
    undefined,
    config,
  );
}

/** 停用（POST /manage/bank-gateway/disable/{instanceId}；仅 status=20 可见）。 */
export function instanceDisable(
  instanceId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    `/manage/bank-gateway/disable/${instanceId}`,
    undefined,
    config,
  );
}

/** 启用（POST /manage/bank-gateway/enable/{instanceId}；仅 status=50 可见）。 */
export function instanceEnable(
  instanceId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    `/manage/bank-gateway/enable/${instanceId}`,
    undefined,
    config,
  );
}

/**
 * 心跳分页（GET /manage/bank-gateway/heartbeat/{instanceId}?page&pageSize）。
 * 源为抽屉内裸 request.get，此处收编进本域 api 层；返回裸 {rows,total}。
 */
export function instanceHeartbeatPage(
  instanceId: number,
  page: number,
  pageSize: number,
  config?: AxiosRequestConfig,
): Promise<HeartbeatPage> {
  return kissenRequest.get<HeartbeatPage>(
    `/manage/bank-gateway/heartbeat/${instanceId}`,
    { ...config, params: { ...config?.params, page, pageSize } },
  );
}
