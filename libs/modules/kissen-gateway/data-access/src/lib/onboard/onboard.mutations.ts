'use client';

/**
 * 入网申请域 mutation hooks。
 * 提交成功后失效入网状态缓存（源 onSubmit 成功后 loadStatus 刷新）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { submitOnboard } from './onboard.api';
import { onboardKeys } from './onboard.keys';
import type { OnboardSubmitReq } from './onboard.model';

/** 提交入网申请（POST /onboard/submit）。 */
export function useOnboardSubmitMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OnboardSubmitReq) => submitOnboard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardKeys.status(projectId) });
    },
  });
}
