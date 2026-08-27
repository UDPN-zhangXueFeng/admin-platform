'use client';

/**
 * LP Token 对参与域 mutation hook（源 applyRow 直接调用 pairApi.apply 等价）。
 *
 * 成功 toast + 切回 Mine tab 由页面承担（源 view.value='mine' + loadAll：
 * 家族级失效使 Mine 作为活动查询立即重查、Eligible 标记失效待下次挂载刷新，
 * 用户可见行为等价）；失败交 lp-client 拦截器统一 toast，此处静默；
 * POST 申请有业务副作用，不重试（sync 域同款 retry:false）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { postPairApply } from './pair.api';
import { pairKeys } from './pair.keys';

/** 参与申请 mutation：入参 pairId，返回受理记录 id。 */
export function usePairApplyMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pairId: number) => postPairApply(pairId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pairKeys.all(projectId) });
    },
    retry: false,
  });
}
