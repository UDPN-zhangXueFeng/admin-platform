'use client';

/**
 * LP 资金池域 mutation hooks（源 `views/pool/index.vue` submitApply 的
 * poolApi.apply 调用，FR-LW-03）。
 *
 * 成功提示与列表重载由 UI 层承担（源 ElMessage.success + load() 等价）；
 * 失败交 lp-client 拦截器统一 toast，这里静默不重试。
 */
import { useMutation } from '@tanstack/react-query';

import { postPoolActivate, postPoolApply } from './pool.api';
import type { PoolApplyReq } from './pool.model';

/** 开池申请（KLPP 审批；受理即回流 /pool/list 可见「Pending」）。 */
export function usePoolApplyMutation() {
  return useMutation({
    mutationFn: (req: PoolApplyReq) => postPoolApply(req),
    retry: false,
  });
}

/**
 * 出款池切换（f0d5b6f 多池模型）。确认流与 inFlightCount 分级提示由 UI 层
 * 承担（源 onActivate：>0 warning 在途警示，否则 success）；失败静默交
 * 拦截器。
 */
export function usePoolActivateMutation() {
  return useMutation({
    mutationFn: (poolId: number) => postPoolActivate(poolId),
    retry: false,
  });
}
