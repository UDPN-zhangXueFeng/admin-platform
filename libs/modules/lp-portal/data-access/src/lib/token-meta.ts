'use client';

/**
 * 「Bank + Token」统一展示口径（源 `src/utils/token-meta.ts` v2.3 e591f85
 * 平移）：token 元数据经 token/list 全量拉取后建立 tokenNo + tokenCode 双键
 * 索引（tx 流水行只有 code，pair 行两者都有），页面各自消费 useTokenMeta()。
 *
 * Vue 版的模块级缓存 + inflight 去重 + 失败清缓存可重试，在 React 侧由
 * TanStack Query 等价承载（共享 QueryClient 去重并发、错误态可 refetch）；
 * lookup 失败统一回退展示传入标识本身（label/bankOf/symOf 三出口一致）。
 */
import { useCallback, useMemo } from 'react';

import { useTokenListQuery } from './token/token.queries';
import type { TokenRow } from './types';

/** token 元数据（建索引用的行切片）。 */
export interface TokenMeta {
  bankName: string;
  bankCode: string;
  tokenName: string;
  /** 缩写（如 USDC）；token 对紧凑式源/目标优先用 symbol（v2.3.1 e591f85）。 */
  symbol: string;
}

function index(rows: TokenRow[]): Map<string, TokenMeta> {
  const m = new Map<string, TokenMeta>();
  for (const r of rows) {
    const meta: TokenMeta = {
      bankName: r.bankName || '',
      bankCode: r.bankCode || '',
      tokenName: r.tokenName || '',
      symbol: r.symbol || '',
    };
    if (r.tokenNo && !m.has(r.tokenNo)) m.set(r.tokenNo, meta);
    if (r.tokenCode && !m.has(r.tokenCode)) m.set(r.tokenCode, meta);
  }
  return m;
}

/**
 * token 元数据 hook。
 *
 * @param projectId 缓存隔离键（与各页 useXxxQuery 同源传入）。
 * @returns metaMap 双键索引；label = 「银行 Token」文本（银行缺失时仅标识）；
 *   bankOf 仅取银行名（token 对 slash 紧凑式银行行）；symOf 仅取 symbol
 *   缩写（紧凑式币种行，缺失回退传入标识）。
 */
export function useTokenMeta(projectId: string) {
  const query = useTokenListQuery(projectId);
  const metaMap = useMemo(
    () => index(query.data ?? []),
    [query.data],
  );

  const label = useCallback(
    (tokenKey?: string | null): string => {
      if (!tokenKey) return '-';
      const meta = metaMap.get(tokenKey);
      const bank = meta?.bankName || meta?.bankCode || '';
      return bank ? `${bank} ${tokenKey}` : tokenKey;
    },
    [metaMap],
  );

  const bankOf = useCallback(
    (tokenKey?: string | null): string => {
      if (!tokenKey) return '-';
      const meta = metaMap.get(tokenKey);
      return meta?.bankName || meta?.bankCode || tokenKey;
    },
    [metaMap],
  );

  const symOf = useCallback(
    (tokenKey?: string | null): string => {
      if (!tokenKey) return '-';
      const meta = metaMap.get(tokenKey);
      return meta?.symbol || tokenKey;
    },
    [metaMap],
  );

  return { metaMap, label, bankOf, symOf };
}
