'use client';

/**
 * LP 资金池域 mutation hooks。
 * 池列表页面只读；2026-11-04 起「独立开通/编辑资金池」入口下线（后端 /lp-pool/save 已移除），
 * 资金池只跟着 token 对走，由参与对审批通过时按两侧地址物化。
 * 错误 toast 由页面层 onError 呈现（对齐源拦截器统一提示语义）。
 */
import { useMutation } from '@tanstack/react-query';

import { lpPoolPrecheck } from './lp-pool.api';
import type { LpOnboardPair } from '../lp/lp.model';

/**
 * 余额预检（POST 非缓存，mutation 形态）：按 lp×token×地址分组 Σ 校验，
 * 结果由页面层渲染 PrecheckDialog；allPass=false 时阻断提交。
 */
export function useLpPoolPrecheckMutation() {
  return useMutation({
    mutationFn: (vars: { lpId?: number; pairs: LpOnboardPair[] }) =>
      lpPoolPrecheck(vars),
  });
}
