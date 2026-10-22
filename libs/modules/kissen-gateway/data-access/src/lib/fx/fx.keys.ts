/** fx 域 query key factory（维度：view=分页+筛选 / allPairs 元数据全量 / detail）。 */
import type { FxViewPageReq } from './fx.model';

export const fxKeys = {
  all: ['kissen-gateway', 'fx'] as const,
  view: (req: FxViewPageReq) => [...fxKeys.all, 'view', req] as const,
  allPairs: () => [...fxKeys.all, 'all-pairs'] as const,
  detail: (pairId: number) => [...fxKeys.all, 'detail', pairId] as const,
} as const;
