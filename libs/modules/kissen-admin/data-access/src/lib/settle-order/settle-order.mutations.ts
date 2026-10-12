'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { settleOrderKeys } from './settle-order.keys';
import { settleOrderConfirm, settleOrderVoid } from './settle-order.api';
import type {
  SettleOrderConfirmReq,
  SettleOrderVoidReq,
} from './settle-order.model';

/** 提交结算单确认审批（KSC，仅 status 10）。成功后失效列表与该单详情。 */
export function useSettleOrderConfirmMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SettleOrderConfirmReq) => settleOrderConfirm(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: settleOrderKeys.lists(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: settleOrderKeys.detail(projectId, variables.orderId),
      });
    },
  });
}

/**
 * 作废结算单（AD-25：仅 status 10 → 45；同周期可重新生成）。
 * 成功后失效列表与该单详情。
 */
export function useSettleOrderVoidMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SettleOrderVoidReq) => settleOrderVoid(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: settleOrderKeys.lists(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: settleOrderKeys.detail(projectId, variables.orderId),
      });
    },
  });
}
