/**
 * mmf apply mutation invalidate 单测。
 *
 * 验收（mmf.md 第9章 / 第8章重构点）：useApplyAccrualMutation 在申报成功后
 * 失效计提列表缓存（mmfKeys.accrual()），否则列表不会刷新，用户看不到刚申报
 * 的记录。源码用 mutate() 刷新，迁移后改为 invalidateQueries（TanStack Query）。
 *
 * 策略：真实 QueryClient + renderHook 触发 mutate；spy invalidateQueries，
 * 断言成功路径命中 `mmfKeys.accrual()` 前缀（覆盖 accrualList + batchApplyList
 * 等所有 accrual 子 key）。apiClient 已被 jest moduleNameMapper 替换为 stub，
 * applyAccrualRecord 直接 resolve，无需真实网络。
 */
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useApplyAccrualMutation } from './mmf.mutations';
import { mmfKeys } from './mmf.keys';
import { setResponse } from '../__mocks__/data-access-api';

const APPLY_URL = '/api/manage/v1/manage/dividend/accrual/record/apply';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
  };
}

describe('useApplyAccrualMutation', () => {
  it('invalidates the accrual query scope on success so the list refreshes', async () => {
    setResponse(APPLY_URL, { ok: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useApplyAccrualMutation(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        applyReqVOList: [{ accrualRecordId: 7, accrualUnits: 100 }],
        ruleId: 1,
        totalAccrualUnits: 100,
      });
    });

    expect(invalidateSpy).toHaveBeenCalled();
    // 失效前缀必须是 mmfKeys.accrual()（['mmf','accrual']），覆盖全部 accrual 子 key。
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: mmfKeys.accrual() }),
    );
    invalidateSpy.mockRestore();
  });

  it('does not invalidate when the apply fails (no spurious refresh)', async () => {
    // 让 stub 抛错以模拟失败路径。
    setResponse(APPLY_URL, undefined);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useApplyAccrualMutation(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      // 注入一个会 reject 的 mutationFn：通过 mock 一时让 apiClient.post 抛错。
      const { apiClient } = await import('../__mocks__/data-access-api');
      const postSpy = jest
        .spyOn(apiClient, 'post')
        .mockRejectedValueOnce(new Error('apply failed'));
      await expect(
        result.current.mutateAsync({
          applyReqVOList: [{ accrualRecordId: 1, accrualUnits: 1 }],
        }),
      ).rejects.toThrow('apply failed');
      postSpy.mockRestore();
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });
});
