'use client';

/**
 * 实例引导域 read-query hooks（源 `views/onboard/index.vue` activated 轮询）。
 */
import { useQuery } from '@tanstack/react-query';

import { getBootstrapState } from './bootstrap.api';
import { bootstrapKeys } from './bootstrap.keys';

/** 引导状态（激活流程轮询；accessKeyStatus ABSENT/VALID/INVALID 三态消费方）。 */
export function useBootstrapStateQuery(enabled = true) {
  return useQuery({
    queryKey: bootstrapKeys.state(),
    queryFn: ({ signal }) => getBootstrapState({ signal }),
    enabled,
  });
}
