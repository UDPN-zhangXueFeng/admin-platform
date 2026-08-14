import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  SplitLpOption,
  SplitTransferListFilter,
  SplitTransferListReq,
  SplitTransferRow,
  SplitTransferSaveReq,
} from './split-transfer.model';

/** 分成划转分页列表（POST /manage/split-transfer/list，{ page, data }）。 */
export function getSplitTransferList(
  req: SplitTransferListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<SplitTransferRow>> {
  return kissenPage<SplitTransferRow, SplitTransferListFilter>(
    '/manage/split-transfer/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/**
 * 对已确认（status=20）结算单发起分成划转审批（KST）。
 * 失败重提复用原记录；无独立新建入口（POST /manage/split-transfer/save）。
 */
export function splitTransferSave(
  req: SplitTransferSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ transferId: number }> {
  return kissenRequest.post<{ transferId: number }>(
    '/manage/split-transfer/save',
    req,
    config,
  );
}

/**
 * LP 选项（跨域薄调用）。源 index.vue 用 api/lp.ts 的
 * `lpList({ pageNum:1, pageSize:200, data:{} })`，此处忠实移植端点与请求体。
 */
export async function getSplitLpOptions(
  config?: AxiosRequestConfig,
): Promise<SplitLpOption[]> {
  const res = await kissenPage<SplitLpOption, Record<string, unknown>>(
    '/manage/lp/list',
    { pageNum: 1, pageSize: 200, filter: {} },
    config,
  );
  return res.data;
}
