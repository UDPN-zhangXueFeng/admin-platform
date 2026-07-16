/**
 * blockchain mutations invalidate 单测。
 *
 * 验收（blockchain.md 第9章 / 第8章风险点）：node 写操作（save/edit/updateState）
 * 成功后失效 node 查询缓存（blockchainKeys.node()），否则列表/详情/参数明细不会
 * 刷新。下载成功后失效 smart-contract 列表缓存。
 *
 * 对齐 mmf.mutations.spec.tsx（已验收范本），结构一致。
 *
 * 策略：真实 QueryClient + renderHook 触发 mutate；spy invalidateQueries，
 * 断言成功路径命中对应 key 前缀。apiClient 已被 jest moduleNameMapper 替换为 stub，
 * 写操作直接 resolve，无需真实网络。
 */
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import {
  useDownloadSmartContractMutation,
  useEditNodeMutation,
  useSaveNodeMutation,
  useUpdateNodeStateMutation,
} from './blockchain.mutations';
import { blockchainKeys } from './blockchain.keys';
import { calls, resetCalls, setResponse } from '../__mocks__/data-access-api';

const NODE_ADD_URL = '/api/manage/v1/node/manage/add';
const NODE_EDIT_URL = '/api/manage/v1/node/manage/edit';
const NODE_UPDATE_STATE_URL = '/api/manage/v1/node/manage/updateState';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
  };
}

describe('useSaveNodeMutation', () => {
  beforeEach(() => resetCalls());

  it('invalidates the node query scope on success so the list refreshes', async () => {
    setResponse(NODE_ADD_URL, { ok: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSaveNodeMutation(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        blockchainId: '1',
        nodeLocationId: '2',
        browserUrl: 'https://etherscan.io',
        nodeParamsDetail: [],
      });
    });

    expect(invalidateSpy).toHaveBeenCalled();
    // 失效前缀必须是 blockchainKeys.node()（['blockchain','node']），
    // 覆盖 node 列表 / 详情 / 参数明细等全部 node 子 key。
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: blockchainKeys.node() }),
    );
    invalidateSpy.mockRestore();
  });
});

describe('useEditNodeMutation', () => {
  beforeEach(() => resetCalls());

  it('invalidates the node query scope on success', async () => {
    setResponse(NODE_EDIT_URL, { ok: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useEditNodeMutation(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        blockchainId: '1',
        nodeLocationId: '2',
        browserUrl: 'https://etherscan.io',
        nodeParamsDetail: [
          { paramKey: 'rpc', paramName: 'RPC', paramValue: 'http://x' },
        ],
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: blockchainKeys.node() }),
    );
    invalidateSpy.mockRestore();
  });
});

describe('useUpdateNodeStateMutation (启停删共用)', () => {
  beforeEach(() => resetCalls());

  it('invalidates the node scope on a successful ENABLE (state:1)', async () => {
    setResponse(NODE_UPDATE_STATE_URL, { ok: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateNodeStateMutation(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        blockchainId: '1',
        nodeLocationId: '2',
        state: 1,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: blockchainKeys.node() }),
    );
    invalidateSpy.mockRestore();
  });

  it('passes state:3 through to the updateState endpoint (delete via Modal)', async () => {
    setResponse(NODE_UPDATE_STATE_URL, { ok: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateNodeStateMutation(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        blockchainId: '1',
        nodeLocationId: '2',
        state: 3,
      });
    });

    // 删除走同一 endpoint，state:3 区分；mutation 成功后失效 node 缓存（列表自动刷新）。
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: blockchainKeys.node() }),
    );
    // 请求体携带 state:3（删除语义），证明启停删共用同一 mutation/endpoint。
    const updateCall = calls.find((c) => c.url === NODE_UPDATE_STATE_URL);
    expect(updateCall?.data).toEqual({
      blockchainId: '1',
      nodeLocationId: '2',
      state: 3,
    });
    invalidateSpy.mockRestore();
  });
});

describe('useDownloadSmartContractMutation', () => {
  // 下载不经 apiClient（用 fetch），此处仅验证成功后失效 smart-contract 列表缓存。
  // jsdom 可能未定义 URL.createObjectURL，故用 Object.defineProperty 显式安装 stub。
  const FILE_ID = 'https://files.example.com';
  let originalCreate: typeof URL.createObjectURL;
  let originalRevoke: typeof URL.revokeObjectURL;

  beforeEach(() => {
    resetCalls();
    process.env.NEXT_PUBLIC_FILE_ID = FILE_ID;
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn().mockReturnValue('blob:fake'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_FILE_ID;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreate,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevoke,
    });
    jest.restoreAllMocks();
  });

  it('invalidates the smart-contract list scope after a successful download', async () => {
    // stub fetch（成功 200 + 空 disposition）。
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['x'])),
      headers: new Headers(),
    });
    global.fetch = fetchSpy as unknown as typeof global.fetch;

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDownloadSmartContractMutation(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ busId: '1', busType: 'pkg' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: blockchainKeys.smartContract() }),
    );
    invalidateSpy.mockRestore();
  });
});
