'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getBizRecordObjectPage } from './biz-record.api';
import { bizRecordKeys } from './biz-record.keys';
import type { BizRecordListReq } from './biz-record.model';

/** 某个对象的业务操作历史（LP 详情「Operation History」等）。 */
export function useBizRecordObjectQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: BizRecordListReq },
  enabled = true,
) {
  return useQuery({
    queryKey: bizRecordKeys.list(projectId, params),
    queryFn: ({ signal }) => getBizRecordObjectPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
