'use client';

/**
 * Token 管理域 read-query hooks。
 */
import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { tokenList, tokenListAll } from './token.api';
import { tokenKeys } from './token.keys';
import type {
  TokenListFilter,
  TokenListPageReq,
  TokenRow,
} from './token.model';

/**
 * 全量 Token 列表（逐页拉取，供元数据索引与选项使用）。
 */
export function useTokenListQuery(
  projectId: string,
  filter: TokenListFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: tokenKeys.list(projectId, filter),
    queryFn: ({ signal }) => tokenListAll(filter, { signal }),
    enabled,
  });
}

/** Token 管理列表的服务端分页查询。 */
export function useTokenListPageQuery(
  projectId: string,
  req: TokenListPageReq,
  enabled = true,
) {
  return useQuery({
    queryKey: tokenKeys.page(projectId, req),
    queryFn: ({ signal }) => tokenList(req, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Token 元数据查找（源 utils/token-meta.ts，4609208 2026-09-18）：
 * `useTokenListQuery(projectId, {})` 逐页读取全量 + tokenNo/tokenCode 双键索引。
 *
 * - `decimalsOf`：decimalDigits 查得 null/负数按 2（token_info DDL 默认）；
 *   未加载完成或键未命中同样回退 2——回退与后端缺省同尺，加载完成后自动重渲染。
 * - `symOf`：symbol 缺失回退传入标识本身（调用方零判空）。
 */
export function useTokenMeta(projectId: string) {
  const { data: rows } = useTokenListQuery(projectId, {});

  const index = React.useMemo(() => {
    const m = new Map<string, TokenRow>();
    for (const r of rows ?? []) {
      if (r.tokenNo && !m.has(r.tokenNo)) m.set(r.tokenNo, r);
      if (r.tokenCode && !m.has(r.tokenCode)) m.set(r.tokenCode, r);
    }
    return m;
  }, [rows]);

  const decimalsOf = React.useCallback(
    (key?: string | null): number => {
      const hit = key ? index.get(key) : undefined;
      const d = hit?.decimalDigits;
      return d === null || d === undefined || d < 0 ? 2 : d;
    },
    [index],
  );

  const symOf = React.useCallback(
    (key?: string | null): string => (key ? index.get(key)?.symbol || key : ''),
    [index],
  );

  return { decimalsOf, symOf };
}
