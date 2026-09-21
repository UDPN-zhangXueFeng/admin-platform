'use client';

/** auth 域 read hooks。 */
import { useQuery } from '@tanstack/react-query';

import { lpAuthKeys } from './auth.keys';
import { getLpUser } from './auth.session';

/**
 * 本地持久化会话读取。源 auth 域无服务端读端点：profile 页直接读
 * store.userInfo，菜单树随登录响应整体持久化、刷新不丢（源 store 语义）。
 * 布局层装配侧边栏 / 守卫判 firstLogin 经此消费；登录/登出/改密 mutation
 * 成功后会失效本 key 触发重读。
 */
export function useLpSessionQuery(projectId: string) {
  return useQuery({
    queryKey: lpAuthKeys.session(projectId),
    queryFn: async () => getLpUser(),
    staleTime: Infinity,
    retry: false,
  });
}
