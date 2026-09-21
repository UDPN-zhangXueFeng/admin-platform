'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bankGatewayKeys } from './bank-gateway.keys';
import { registerBankGateway, testBankGateway } from './bank-gateway.api';
import type { BankGatewayRegisterReq } from './bank-gateway.model';

/**
 * 网关注册/更新。成功后失效该行连接信息缓存。
 * 银行列表连通性列由调用方（页面）在关闭弹窗后刷新 bank 列表。
 */
export function useRegisterBankGatewayMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BankGatewayRegisterReq) => registerBankGateway(data),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: bankGatewayKeys.detail(projectId, vars.bankId),
      });
    },
  });
}

/**
 * 测试连接。成功后失效该行连接信息缓存（连通性/心跳已更新）。
 * 银行列表连通性列由调用方（页面）在关闭弹窗后刷新 bank 列表。
 */
export function useTestBankGatewayMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bankId: number) => testBankGateway(bankId),
    onSuccess: (_data, bankId) => {
      void queryClient.invalidateQueries({
        queryKey: bankGatewayKeys.detail(projectId, bankId),
      });
    },
  });
}
