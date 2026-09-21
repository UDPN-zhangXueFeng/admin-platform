import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-client';
import type {
  DisburseSpenderRow,
  SpenderSaveReq,
  SpenderStatusReq,
} from './disburse-spender.model';

/**
 * 注册表列表（POST /manage/disburse-spender/list）。
 * body 为过滤对象直传（可按 tokenId 筛），返回裸数组，无分页。
 */
export function spenderList(
  req: { tokenId?: number },
  config?: AxiosRequestConfig,
): Promise<DisburseSpenderRow[]> {
  return kissenRequest.post<DisburseSpenderRow[]>(
    '/manage/disburse-spender/list',
    req,
    config,
  );
}

/**
 * 录入/轮换（POST /manage/disburse-spender/save）。
 * tokenId 已存在即覆盖（再次保存立即替换旧地址与私钥）；私钥密文落库不回显。
 */
export function spenderSave(
  req: SpenderSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ tokenId: number }> {
  return kissenRequest.post<{ tokenId: number }>(
    '/manage/disburse-spender/save',
    req,
    config,
  );
}

/** 启用/停用（POST /manage/disburse-spender/status；disabled=true 冻结该 token 解付）。 */
export function spenderStatus(
  req: SpenderStatusReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/disburse-spender/status', req, config);
}
