'use client';

/**
 * 入网申请域 read-query hooks。
 * 全部接受 projectId 作为首参，query key 跨项目隔离。
 */
import { useQuery } from '@tanstack/react-query';

import { getOnboardBankInfo, getOnboardStatus } from './onboard.api';
import { onboardKeys } from './onboard.keys';

/** 当前入网状态（尚无申请时 data 为 null，页面据此渲染提交表单）。 */
export function useOnboardStatusQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: onboardKeys.status(projectId),
    queryFn: ({ signal }) => getOnboardStatus({ signal }),
    enabled,
  });
}

/** 银行基本信息（Kissen 推送；入网页头部展示）。 */
export function useOnboardBankInfoQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: onboardKeys.bankInfo(projectId),
    queryFn: ({ signal }) => getOnboardBankInfo({ signal }),
    enabled,
  });
}
