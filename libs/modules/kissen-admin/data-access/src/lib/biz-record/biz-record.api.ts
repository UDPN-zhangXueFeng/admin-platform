import type { AxiosRequestConfig } from 'axios';

import { kissenPage } from '../kissen-client';
import type { BizRecordListReq, BizRecordRow } from './biz-record.model';

/** 按对象分页查业务操作流水（POST /manage/biz-record/object-page）。 */
export function getBizRecordObjectPage(
  req: { pageNum: number; pageSize: number; filter: BizRecordListReq },
  config?: AxiosRequestConfig,
) {
  return kissenPage<BizRecordRow, BizRecordListReq>(
    '/manage/biz-record/object-page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}
