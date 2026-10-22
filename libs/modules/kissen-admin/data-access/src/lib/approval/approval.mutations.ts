'use client';

import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { lpKeys } from '../lp/lp.keys';
import { lpPairKeys } from '../lp-pair/lp-pair.keys';
import { lpPoolKeys } from '../lp-pool/lp-pool.keys';
import { settleOrderKeys } from '../settle-order/settle-order.keys';
import { tokenPairKeys } from '../token-pair/token-pair.keys';
import { approvalKeys } from './approval.keys';
import {
  approvalPreviousStep,
  approvalProcess,
  approvalWithdraw,
} from './approval.api';

/**
 * 审批动作成功后的统一失效：审批域全量（待办/已办/我发起/详情/业务键详情）
 * + 按 busCode 映射的业务域缓存。await 保证活跃查询刷新完成后 mutation 才
 * 结束 pending，界面据此展示刷新态（按钮禁用）。
 */
async function invalidateApprovalCaches(
  queryClient: QueryClient,
  projectId: string,
  busCode: string | undefined,
) {
  await queryClient.invalidateQueries({
    queryKey: approvalKeys.all(projectId),
  });
  const domainKeys: Array<readonly unknown[]> = [];
  switch (busCode) {
    case 'kissen_lp_pair':
    case 'kissen_lp_split':
      // 参与对/分成审批通过 → 参与对列表、LP 详情聚合、池快照都可能变化
      domainKeys.push(
        lpPairKeys.all(projectId),
        lpKeys.all(projectId),
        lpPoolKeys.all(projectId),
      );
      break;
    case 'kissen_rate_change':
    case 'kissen_pair_toggle':
      domainKeys.push(tokenPairKeys.all(projectId));
      break;
    case 'kissen_settle_confirm':
    case 'kissen_split_transfer':
      domainKeys.push(settleOrderKeys.all(projectId));
      break;
    case 'kissen_lp_pool':
      domainKeys.push(lpPoolKeys.all(projectId), lpKeys.all(projectId));
      break;
    default:
      break;
  }
  await Promise.all(
    domainKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

/** 审批处理：approve 3 通过 / 2 拒绝（POST /mult/approval/process）。 */
export function useApprovalProcessMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      busCode: string;
      taskId: number;
      approve: number;
      remarks?: string;
    }) => approvalProcess(data),
    onSuccess: async (_data, variables) => {
      await invalidateApprovalCaches(queryClient, projectId, variables.busCode);
    },
  });
}

/** 退回上一步（POST /mult/approval/previousStep；remarks 必填）。 */
export function useApprovalPreviousStepMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      busCode: string;
      taskId: number;
      remarks: string;
    }) => approvalPreviousStep(data),
    onSuccess: async (_data, variables) => {
      await invalidateApprovalCaches(queryClient, projectId, variables.busCode);
    },
  });
}

/** 撤回：仅待审核（5）且发起人本人（POST /mult/approval/withdraw）。 */
export function useApprovalWithdrawMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      busCode: string;
      taskId: number;
      remarks?: string;
    }) => approvalWithdraw(data),
    onSuccess: async (_data, variables) => {
      await invalidateApprovalCaches(queryClient, projectId, variables.busCode);
    },
  });
}
