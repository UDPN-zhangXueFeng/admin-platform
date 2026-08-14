'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { bankKeys } from './bank.keys';
import {
  getBankApprovalDetail,
  getBankApprovalDonePage,
  getBankApprovalTodoPage,
  getBankDetail,
  getBankList,
  getBankSupportedCurrencies,
} from './bank.api';
import type {
  BankApprovalPageReq,
  BankListFilter,
} from './bank.model';

/** 银行分页列表（翻页/筛选时保留旧数据，提升体验）。 */
export function useBankListQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: BankListFilter },
  enabled = true,
) {
  return useQuery({
    queryKey: bankKeys.list(projectId, params),
    queryFn: ({ signal }) => getBankList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 银行详情（编辑回填 / 详情页）。bankId 缺省时禁用。 */
export function useBankDetailQuery(
  projectId: string,
  bankId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: bankKeys.detail(projectId, bankId),
    queryFn: ({ signal }) => getBankDetail(bankId as number, { signal }),
    enabled: enabled && bankId != null,
  });
}

/** 已入网银行支持币种并集（货币对表单币种下拉数据源）。 */
export function useBankSupportedCurrenciesQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: bankKeys.supportedCurrencies(projectId),
    queryFn: ({ signal }) => getBankSupportedCurrencies({ signal }),
    enabled,
  });
}

/** 银行审批待办分页。 */
export function useBankApprovalTodoQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; data: BankApprovalPageReq },
  enabled = true,
) {
  return useQuery({
    queryKey: bankKeys.approvalTodo(projectId, params),
    queryFn: ({ signal }) => getBankApprovalTodoPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 银行审批已办分页。 */
export function useBankApprovalDoneQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; data: BankApprovalPageReq },
  enabled = true,
) {
  return useQuery({
    queryKey: bankKeys.approvalDone(projectId, params),
    queryFn: ({ signal }) => getBankApprovalDonePage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 审批详情（业务内容 + 操作能力位）。busCode/taskId 缺省时禁用。 */
export function useBankApprovalDetailQuery(
  projectId: string,
  busCode: string | undefined,
  taskId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: bankKeys.approvalDetail(projectId, busCode ?? '', taskId),
    queryFn: ({ signal }) =>
      getBankApprovalDetail(
        { busCode: busCode as string, taskId: taskId as number },
        { signal },
      ),
    enabled: enabled && busCode != null && taskId != null,
  });
}
