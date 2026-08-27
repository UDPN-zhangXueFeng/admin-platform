'use client';

/**
 * 汇率查询聚合域 read-query hooks（源 `views/fx/index.vue` 加载）。
 */
import { useQuery } from '@tanstack/react-query';

import { getFxView } from './fx.api';
import { fxKeys } from './fx.keys';

/** 汇率查询聚合（只读表数据源）。 */
export function useFxViewQuery(enabled = true) {
  return useQuery({
    queryKey: fxKeys.view(),
    queryFn: ({ signal }) => getFxView({ signal }),
    enabled,
  });
}
