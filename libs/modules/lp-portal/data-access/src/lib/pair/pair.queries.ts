'use client';

/**
 * LP Token 对参与域 read-query hooks（源单视图独立 load 等价）。
 *
 * Mine 列表由单一真实查询提供。参与对新增和变更由管理侧发起审批，Portal
 * 不再加载或提交 Eligible/Apply 数据（3a57bbd 决议⑤，usePairEligibleQuery
 * 已剪除）。
 */
import { useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { getPairList } from './pair.api';
import { pairKeys } from './pair.keys';

/**
 * 0024（kissen-api 不可用）不做重试：源无重试；其余错误沿用共享 QueryClient
 * 策略（rate/split 同款豁免——LpApiError 无 status 字段默认会被当未知错误重试）。
 */
const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** 我的 token 对（Mine tab 数据源，不分页全量）。 */
export function usePairListQuery(projectId: string) {
  return useQuery({
    queryKey: pairKeys.list(projectId),
    queryFn: ({ signal }) => getPairList({ signal }),
    retry: retryNotServiceDown,
  });
}
