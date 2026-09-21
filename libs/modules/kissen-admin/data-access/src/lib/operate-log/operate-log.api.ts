/**
 * 操作日志域 raw API 层，忠实移植源 `api/operate-log.ts`。
 * 源仅一个端点：POST /manage/log/page（分页，`{page,data}` 包体 → kissenPage 自包装）。
 * 纯查询域，无写端点，故无 mutations 文件。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenPage } from '../kissen-client';
import type { OperateLogListReq, OperateLogRow } from './operate-log.model';

/** 操作日志分页（源 operateLogPage：POST /manage/log/page）。 */
export function getOperateLogPage(
  req: { pageNum: number; pageSize: number; filter: OperateLogListReq },
  config?: AxiosRequestConfig,
) {
  return kissenPage<OperateLogRow, OperateLogListReq>(
    '/manage/log/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}
