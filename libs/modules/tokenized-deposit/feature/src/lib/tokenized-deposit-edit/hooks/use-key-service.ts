'use client';

import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  useKeyServiceListQuery,
  type KeyServiceOption,
  type TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';

/**
 * useKeyService — 密钥服务下拉（edit 页，按 blockchainId 拉取 + 默认选首项）。
 *
 * 迁移自 td-manage `edit/hooks/useKeyService.ts`（34 行）。
 *
 * ## 时序（严格保留源行为）
 *
 * blockchainId 变化时：
 * 1. 调用 `useKeyServiceListQuery`（query 层已 `select` 过滤 null/非数组）。
 * 2. data 到达后（仅 `shouldSelectFirst` 为 true 时）：
 *    - 有数据 → `form.setValue('keyServiceName', data[0].keyServiceCode)`
 *      （表单字段名 keyServiceName，取 option.keyServiceCode，
 *      字段命名转换：表单 keyServiceName ↔ API keyServiceCode）。
 *    - 无数据 → `form.setValue('keyServiceName', '')`。
 *
 * ## shouldSelectFirst（新增态 vs 编辑态）
 *
 * 源行为：每次 `getKeyServiceList` 执行都会默认选首项；但编辑回填态
 * （useDetailInit）在 `await getKeyServiceList` 之后用 `setFieldsValue` 整批
 * 覆盖（含 `keyServiceName: detail.keyServiceCode`），所以最终值是回填值。
 *
 * 在 TanStack Query 架构下，query data 到达是异步的，回填（form.setValue）
 * 可能在 data 到达前执行，effect 会覆盖回填值。为忠实源时序，编辑态
 * （query.code 存在）传 `shouldSelectFirst=false`，由 useDetailInit 负责回填；
 * 新增态传 true，保留默认选首项。
 *
 * ## 与源差异
 *
 * antd Form + 命令式 API → react-hook-form + TanStack Query（apiClient 已解包信封，
 * 去掉 `res.data.code` 检查）。
 *
 * @param form react-hook-form 表单实例（由调用方 td-13 创建传入）
 * @param blockchainId 当前选中区块链 ID（query 启用条件）
 * @param shouldSelectFirst 是否在 data 到达后默认选首项（新增 true / 编辑 false）
 */
export interface UseKeyServiceParams {
  form: UseFormReturn<TDEditFormValues>;
  blockchainId: number | string | undefined;
  /** 新增态传 true（默认选首项）；编辑态传 false（由 useDetailInit 回填）。 */
  shouldSelectFirst?: boolean;
  /**
   * 跳过一次「默认选首项」的 ref（草稿恢复用）。
   *
   * 草稿恢复 form.reset() 会改 blockchainId → query 重查 → data 到达时本 effect
   * 会把 keyServiceName 覆盖为首项，clobber 恢复值。恢复前置 ref.current=true，
   * effect 命中时重置为 false 并跳过本次，恢复值得以保留。
   */
  suppressSelectFirstOnceRef?: React.RefObject<boolean>;
}

export interface UseKeyServiceReturn {
  /** 密钥服务下拉列表（query 层已过滤 null/非数组）。 */
  keyServiceList: KeyServiceOption[];
  /** 是否加载中。 */
  isLoading: boolean;
}

export function useKeyService({
  form,
  blockchainId,
  shouldSelectFirst = true,
  suppressSelectFirstOnceRef,
}: UseKeyServiceParams): UseKeyServiceReturn {
  const { data: keyServiceList, isLoading } =
    useKeyServiceListQuery(blockchainId);

  // 默认选首项（仅新增态；编辑态由 useDetailInit 回填负责，避免覆盖）。
  useEffect(() => {
    if (!shouldSelectFirst) return;
    if (isLoading) return;
    if (!keyServiceList) return;

    // 草稿恢复后的首次到达跳过，保留恢复值（见 UseKeyServiceParams 注释）。
    if (suppressSelectFirstOnceRef?.current) {
      suppressSelectFirstOnceRef.current = false;
      return;
    }

    if (keyServiceList.length > 0) {
      const first = keyServiceList[0];
      form.setValue('keyServiceName', first?.keyServiceCode ?? '');
    } else {
      form.setValue('keyServiceName', '');
    }
  }, [
    form,
    keyServiceList,
    isLoading,
    shouldSelectFirst,
    suppressSelectFirstOnceRef,
  ]);

  return {
    keyServiceList: keyServiceList ?? [],
    isLoading,
  };
}
