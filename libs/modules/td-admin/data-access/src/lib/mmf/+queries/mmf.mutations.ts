'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applyAccrualRecord, getBatchApplyList } from '../mmf.api';
import type {
  AccrualApplyReqVO,
  BatchApplyListItem,
  BatchApplyListParams,
} from '../mmf.model';
import { mmfKeys } from './mmf.keys';

/**
 * mmf 模块 mutations（写操作）。
 *
 * 从 queries.ts 中拆分出来，单独管理写入语义的 hooks。
 * queries.ts 中保留同名的 re-export，避免调用方 import 路径变更。
 */

/** 计提申报 mutation（批量/单条统一入口）。
 *
 * - 批量申报：{ applyReqVOList, ruleId, totalAccrualUnits }
 * - 单条申报：{ applyReqVOList: [{ accrualRecordId, accrualUnits }] }
 *
 * 成功后失效计提列表 + 批量申报列表缓存。
 */
export function useApplyAccrualMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, AccrualApplyReqVO>({
    mutationFn: (dto) => applyAccrualRecord(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: mmfKeys.accrual() });
    },
  });
}

/** 批量申报查询 mutation（手动触发，用于 Modal 内「查询」按钮）。
 *
 * 与 useBatchApplyListQuery（enabled=false）不同，此 mutation 适合与 Button onClick 绑定：
 * ```
 * const { mutate, data, isPending } = useBatchApplyListMutation();
 * <Button onClick={() => mutate({ ruleId, accrualTimeStartDate, accrualTimeEndDate })}>
 *   查询
 * </Button>
 * ```
 */
export function useBatchApplyListMutation() {
  return useMutation<BatchApplyListItem[], Error, BatchApplyListParams>({
    mutationFn: (params) => getBatchApplyList(params),
  });
}
