'use client';

/**
 * LP 预授权域 read-query hook（v2 只读快照，无 mutation）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpPreauthKeys } from './lp-preauth.keys';
import { getLpPreauthList } from './lp-preauth.api';
import type { LpPreauthListReq } from './lp-preauth.model';

/** 预授权快照分页列表（翻页/筛选时保留旧数据）。 */
export function useLpPreauthListQuery(
  projectId: string,
  params: LpPreauthListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPreauthKeys.list(projectId, params),
    queryFn: ({ signal }) => getLpPreauthList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
