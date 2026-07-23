import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@myorg/shared/data-access-api';
import {
  getFinanceBookByReserve,
  getRoleWalletDetail,
} from '../tokenized-deposit.api';
import {
  useContractDeployHistoryQuery,
  useDeployStepDetailQuery,
} from './tokenized-deposit.queries';

jest.mock('@myorg/shared/data-access-api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('@myorg/modules/tokenized-deposit/util', () => ({
  getEncryptionData: jest.fn((value: string) => value),
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({
    children,
  }: React.PropsWithChildren): React.JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

describe('tokenized-deposit optional queries', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('represents an absent deploy history as null so the overview query remains successful', async () => {
    post.mockResolvedValue([]);
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useContractDeployHistoryQuery('td-without-history'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('does not request deploy history before the history dialog is opened', () => {
    const queryClient = createQueryClient();

    renderHook(
      () => useContractDeployHistoryQuery('td-without-history', false),
      { wrapper: createWrapper(queryClient) },
    );

    expect(post).not.toHaveBeenCalled();
  });

  it('represents a missing deploy step detail as null instead of an invalid query result', async () => {
    post.mockResolvedValue([]);
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useDeployStepDetailQuery({ taskCode: 'missing-task' }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('normalizes optional finance-book and mock wallet detail results to null', async () => {
    get.mockResolvedValue(null);
    await expect(getFinanceBookByReserve('missing-reserve')).resolves.toBeNull();

    jest.useFakeTimers();
    const detail = getRoleWalletDetail('missing-wallet');
    jest.runAllTimers();

    await expect(detail).resolves.toBeNull();
  });
});
