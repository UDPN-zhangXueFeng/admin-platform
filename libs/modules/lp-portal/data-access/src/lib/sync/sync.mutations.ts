'use client';

/**
 * LP 数据同步域 mutation hook（源 `SyncRefreshButton.vue` 的 refresh 调用）。
 *
 * 成功提示与父页重载由 UI 层组件承担（源 emit('refreshed') 等价
 * onRefreshed 回调）；失败交 lp-client 拦截器统一 toast，这里静默不重试。
 */
import { useMutation } from '@tanstack/react-query';

import { postSyncRefresh, type SyncDomainCode } from './sync.api';

/** 域刷新 mutation：applied>0 有新数据，0 即已是最新。 */
export function useSyncRefreshMutation() {
  return useMutation({
    mutationFn: (domain: SyncDomainCode | SyncDomainCode[]) =>
      postSyncRefresh(domain),
    retry: false,
  });
}
