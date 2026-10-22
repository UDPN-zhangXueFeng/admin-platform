'use client';

/** Token 对分页列表 read-query hooks。 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { tokenPairKeys } from './token-pair.keys';
import { getTokenPairList } from './token-pair.api';
import type {
  TokenPairListFilter,
  TokenPairListReq,
  TokenPairRow,
} from './token-pair.model';

const ALL_LIST_PAGE_SIZE = 100;

/** 已有对总量用于组合判重和 Dashboard 汇总，需收齐服务端分页结果。 */
async function getAllTokenPairRows(
  filter: TokenPairListFilter,
  signal: AbortSignal,
): Promise<TokenPairRow[]> {
  const pageSize = ALL_LIST_PAGE_SIZE;
  const firstPage = await getTokenPairList(
    { pageNum: 1, pageSize, filter },
    { signal },
  );
  const rows = [...firstPage.data];

  for (
    let pageNum = 2;
    rows.length < firstPage.pagination.total;
    pageNum += 1
  ) {
    const nextPage = await getTokenPairList(
      { pageNum, pageSize, filter },
      { signal },
    );
    if (nextPage.data.length === 0) {
      throw new Error(
        `Token pair list ended before its reported total of ${firstPage.pagination.total} rows.`,
      );
    }
    rows.push(...nextPage.data);
  }

  return rows;
}

/** Token 对列表单页（PageResult 响应）。 */
export function useTokenPairListQuery(
  projectId: string,
  req: TokenPairListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: tokenPairKeys.list(projectId, req),
    queryFn: ({ signal }) => getTokenPairList(req, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 拉取全部 Token 对分页，供需要全量集合的非列表场景使用。 */
export function useTokenPairListAllQuery(
  projectId: string,
  filter: TokenPairListFilter = {},
  enabled = true,
) {
  return useQuery({
    queryKey: tokenPairKeys.listAll(projectId, filter),
    queryFn: ({ signal }) => getAllTokenPairRows(filter, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
