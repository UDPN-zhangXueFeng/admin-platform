'use client';

/**
 * Token 域 read-query hooks（分页列表、详情、操作记录分页、筛选选项）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getTokenDetail,
  getTokenFilterOptions,
  getTokenList,
  getTokenOperationLogs,
} from './token.api';
import { tokenKeys } from './token.keys';
import type {
  TokenOperationLogsPageReq,
  TokenPageReq,
} from './token.model';

/** 本实例已注册 token 分页列表（POST /token/list；翻页/换筛选保留旧页）。 */
export function useTokenListQuery(req: TokenPageReq, enabled = true) {
  return useQuery({
    queryKey: tokenKeys.list(req),
    queryFn: ({ signal }) => getTokenList(req, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** token 详情（GET /token/detail/{tokenCode}；无匹配返回 null，页面按空态处理）。 */
export function useTokenDetailQuery(tokenCode: string | undefined) {
  return useQuery({
    queryKey: tokenKeys.detail(tokenCode ?? ''),
    queryFn: ({ signal }) => getTokenDetail(tokenCode as string, { signal }),
    enabled: tokenCode != null && tokenCode !== '',
  });
}

/**
 * Token 操作记录分页（POST /token/operate-logs/{tokenCode}）。
 * 跨 tokenCode 不沿用旧 token 的行（不设 placeholderData）；code 缺失不请求。
 */
export function useTokenOperationLogsQuery(
  tokenCode: string | undefined,
  req: TokenOperationLogsPageReq,
  enabled = true,
) {
  return useQuery({
    queryKey: tokenKeys.operationLogs(tokenCode ?? '', req),
    queryFn: ({ signal }) =>
      getTokenOperationLogs(tokenCode as string, req, { signal }),
    enabled: enabled && tokenCode != null && tokenCode !== '',
  });
}

/** Token 筛选下拉主数据（GET /token/filter-options；集合元素即提交值）。 */
export function useTokenFilterOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: tokenKeys.filterOptions(),
    queryFn: ({ signal }) => getTokenFilterOptions({ signal }),
    enabled,
  });
}
