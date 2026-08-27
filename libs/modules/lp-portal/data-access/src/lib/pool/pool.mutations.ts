'use client';

/**
 * LP 资金池域 mutation hooks（源 `views/pool/index.vue` submitApply 的
 * poolApi.apply 调用，FR-LW-03）。
 *
 * 成功提示与列表重载由 UI 层承担（源 ElMessage.success + load() 等价）；
 * 失败交 lp-client 拦截器统一 toast，这里静默不重试。
 */
import { useMutation } from '@tanstack/react-query';

import { postPoolApply } from './pool.api';
import type { PoolApplyReq } from './pool.model';

/** 开池申请（KLPP 审批；受理即回流 /pool/list 可见「Pending」）。 */
export function usePoolApplyMutation() {
  return useMutation({
    mutationFn: (req: PoolApplyReq) => postPoolApply(req),
    retry: false,
  });
}
