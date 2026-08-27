'use client';

/**
 * Token 域 read-query hooks（源 `views/token/manage.vue` 加载列表）。
 */
import { useQuery } from '@tanstack/react-query';

import { getTokenList } from './token.api';
import { tokenKeys } from './token.keys';

/** 本实例已注册 token 列表（GET /token/list）。 */
export function useTokenListQuery(enabled = true) {
  return useQuery({
    queryKey: tokenKeys.list(),
    queryFn: ({ signal }) => getTokenList({ signal }),
    enabled,
  });
}
