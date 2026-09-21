'use client';

/**
 * 实例密钥域 read-query hooks（源 `views/instance-key/drawer.vue` 打开抽屉 load 视图）。
 */
import { useQuery } from '@tanstack/react-query';

import { getInstanceKeyView } from './instance-key.api';
import { instanceKeyKeys } from './instance-key.keys';

/** 实例密钥视图（双凭证状态总览；抽屉消费方，accessKeyStatus 三态徽标数据源）。 */
export function useInstanceKeyViewQuery(enabled = true) {
  return useQuery({
    queryKey: instanceKeyKeys.view(),
    queryFn: ({ signal }) => getInstanceKeyView({ signal }),
    enabled,
  });
}
