'use client';

/**
 * bank 域 mutation hooks（源 api/bank.ts 写操作）。
 * 提交/更新成功后失效 bank 域缓存（源 onboard 页 infoSubmit 后重新拉 bank/detail 与状态）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { contactUpdate, infoSubmit } from './bank.api';
import { bankKeys } from './bank.keys';
import type { BankInfoSubmitReq } from './bank.model';

/** 银行信息合一提交（POST /bank/info-submit）→ 失效 bank 域缓存。 */
export function useBankInfoSubmitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BankInfoSubmitReq) => infoSubmit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all });
    },
  });
}

/** 联系人就地编辑（POST /bank/contact-update）→ 失效 bank 域缓存。 */
export function useBankContactUpdateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BankInfoSubmitReq) => contactUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all });
    },
  });
}
