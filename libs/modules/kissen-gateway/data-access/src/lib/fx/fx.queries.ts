'use client';

/**
 * 汇率查询聚合域 read-query hooks（源 `views/fx/index.vue` 加载）。
 * useFxViewQuery 供 /fx 列表分页；useFxAllPairsQuery 供元数据消费者
 * （交易页/Overview/Token 详情）共享同一全量缓存，避免列表页 key 覆盖。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getFxAllPairs, getFxPairDetail, getFxView } from './fx.api';
import { fxKeys } from './fx.keys';
import type { FxViewPageReq } from './fx.model';

/** 汇率查询聚合分页（POST /fx/view；翻页/换筛选保留旧页）。 */
export function useFxViewQuery(req: FxViewPageReq, enabled = true) {
  return useQuery({
    queryKey: fxKeys.view(req),
    queryFn: ({ signal }) => getFxView(req, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** FX 全量 token 对（元数据专用，跨页累积；所有消费者共享同一 key）。 */
export function useFxAllPairsQuery(enabled = true) {
  return useQuery({
    queryKey: fxKeys.allPairs(),
    queryFn: ({ signal }) => getFxAllPairs({ signal }),
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
