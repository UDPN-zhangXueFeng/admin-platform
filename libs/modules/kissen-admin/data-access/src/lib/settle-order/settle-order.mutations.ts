'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { settleOrderKeys } from './settle-order.keys';
import {
  settleOrderConfirm,
  settleOrderGenerate,
  settleOrderVoid,
} from './settle-order.api';
import type {
  SettleOrderConfirmReq,
  SettleOrderGenerateReq,
  SettleOrderVoidReq,
} from './settle-order.model';

/** 生成结算单。成功后失效列表（新生成的结算单需刷新）。 */
export function useSettleOrderGenerateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SettleOrderGenerateReq) => settleOrderGenerate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settleOrderKeys.lists(projectId),
      });
    },
  });
}

/** 提交结算单确认审批（KSC，仅 status 10）。成功后失效列表（状态流转 10→20）。 */
export function useSettleOrderConfirmMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SettleOrderConfirmReq) => settleOrderConfirm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settleOrderKeys.lists(projectId),
      });
    },
  });
}

/**
 * 作废结算单（AD-25：仅 status 10 → 45；同周期可重新生成）。
 * 成功后失效列表（状态流转 10→45）。
 */
export function useSettleOrderVoidMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SettleOrderVoidReq) => settleOrderVoid(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settleOrderKeys.lists(projectId),
      });
    },
  });
}
