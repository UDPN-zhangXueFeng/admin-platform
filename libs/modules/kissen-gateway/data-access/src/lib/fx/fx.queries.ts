'use client';

/**
 * 汇率查询聚合域 read-query hooks（源 `views/fx/index.vue` 加载）。
 */
import { useQuery } from '@tanstack/react-query';

import { getFxPairDetail, getFxView } from './fx.api';
import { fxKeys } from './fx.keys';

/** 汇率查询聚合（只读表数据源）。 */
export function useFxViewQuery(enabled = true) {
  return useQuery({
    queryKey: fxKeys.view(),
    queryFn: ({ signal }) => getFxView({ signal }),
    enabled,
  });
}

/** token 对详情（GET /fx/detail/{pairId}；无匹配返回 null，页面按空态处理）。 */
export function useFxPairDetailQuery(pairId: number | undefined) {
  return useQuery({
    queryKey: fxKeys.detail(pairId ?? 0),
    queryFn: ({ signal }) => getFxPairDetail(pairId as number, { signal }),
    enabled: pairId != null && Number.isFinite(pairId),
  });
}
