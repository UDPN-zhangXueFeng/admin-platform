'use client';

/** Token 管理域 read-query hooks。 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tokenList } from './token.api';
import { tokenKeys } from './token.keys';
import type { TokenListFilter, TokenRow } from './token.model';

/**
 * Token 列表（裸数组，无分页；过滤条件即缓存键，过滤变化取新 key）。
 * 跨组契约：FxAgent 的建对弹窗以 `tokenList({ status: 20 })` 取组合来源。
 */
export function useTokenListQuery(
  projectId: string,
  filter: TokenListFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: tokenKeys.list(projectId, filter),
    queryFn: ({ signal }) => tokenList(filter, { signal }),
    enabled,
  });
}

/**
 * Token 元数据查找（源 utils/token-meta.ts，4609208 2026-09-18）：
 * `tokenList({})` 无过滤全量 + tokenNo/tokenCode 双键索引。
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
