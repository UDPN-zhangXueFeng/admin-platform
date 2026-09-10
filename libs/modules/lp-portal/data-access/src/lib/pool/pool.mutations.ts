'use client';

/** 存量 KLPP/出款池切换 mutation；页面入口已下线，保留兼容调用层。 */
import { useMutation } from '@tanstack/react-query';

import { postPoolActivate, postPoolApply } from './pool.api';
import type { PoolApplyReq } from './pool.model';

export function usePoolApplyMutation() {
  return useMutation({
    mutationFn: (req: PoolApplyReq) => postPoolApply(req),
    retry: false,
  });
}

export function usePoolActivateMutation() {
  return useMutation({
    mutationFn: (poolId: number) => postPoolActivate(poolId),
    retry: false,
  });
}
