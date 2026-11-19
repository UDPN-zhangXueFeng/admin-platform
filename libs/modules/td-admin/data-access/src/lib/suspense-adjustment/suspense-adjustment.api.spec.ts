import { apiClient, axiosClient } from '@myorg/shared/data-access-api';
import { getSuspenseAdjustmentList, getTxAccountsLeaf, submitSuspenseAdjustment } from './suspense-adjustment.api';
import { adjustmentEntryAmount, amountExceeds, calculateRemainingAfter, calculateThisAdjustment, formatAmount } from './suspense-adjustment.helpers';
import type { NewAdjustmentForm } from './suspense-adjustment.model';

jest.mock('@myorg/shared/data-access-api', () => ({
  apiClient: { post: jest.fn() },
  axiosClient: { post: jest.fn() },
  ApiError: class extends Error {
    constructor({ message }: { message: string }) { super(message); }
  },
}));

const post = jest.mocked(axiosClient.post);
const base = '/api/finance/v1/finance/suspense-adjustment';
const form: NewAdjustmentForm = {
  suspenseRecordId: 1, suspenseTxnId: 'EOD-123', postingDate: '2026-06-09',
  offsettingEntryFor: 'Cr', adjustmentReason: '  test reason  ',
  entries: [{ rowId: '1', postingDate: '2026-06-09', accountCode: '1001', accountName: 'Test account',
    accountDisplay: '1001 - Test account', drCr: 'Dr', amount: '9007199254740993.01', currency: 'HKD' }],
};

describe('suspense adjustment contracts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses inclusive UTC dates, numeric filters and trimmed IDs', async () => {
    post.mockResolvedValueOnce({ data: { code: '0', data: [] }, status: 200 });
    await expect(getSuspenseAdjustmentList({
      status: 'PARTIALLY_CLEARED', sourceType: 'LOC', suspenseTxnId: ' EOD-123 ',
      transactionId: ' tx ', postingDateStart: '2026-06-09', postingDateEnd: '2026-06-10',
    })).resolves.toEqual({ page: { total: 0 }, rows: [] });
    expect(post).toHaveBeenCalledWith(`${base}/list`, {
      clearStatus: 2, sourceType: 2, suspenseTxnId: 'EOD-123', transactionId: 'tx',
      startDate: Date.UTC(2026, 5, 9), endDate: Date.UTC(2026, 5, 11) - 1,
    }, expect.any(Object));
  });

  it('preserves exact numeric wire amounts and accepts only the old explicit success codes', async () => {
    post.mockImplementationOnce(async (_url, _body, config) => {
      const transform = config?.transformResponse;
      if (typeof transform !== 'function') throw new Error('Missing response transformer');
      const headers = {} as Parameters<typeof transform>[1];
      const context = {} as ThisParameterType<typeof transform>;
      expect(transform.call(context, '{"code":"200"}', headers, 200)).toEqual({ code: '200' });
      return { data: transform.call(context, '{"code":200}', headers, 200), status: 200 };
    });
    await expect(submitSuspenseAdjustment(form)).resolves.toBeNull();
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe(`${base}/adjust`);
    expect(body).toContain('"amount":9007199254740993.01');
    expect(JSON.parse(body)).toMatchObject({ suspenseRecordId: 1, suspenseTxnId: 'EOD-123',
      postingDate: Date.UTC(2026, 5, 9), adjustmentReason: 'test reason',
      entries: [{ accountCode: '1001', accountName: 'Test account', direction: 1 }],
    });
    expect(config?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('does not report business or malformed responses as success', async () => {
    const failure = new Error('Adjustment already pending');
    post.mockRejectedValueOnce(failure).mockResolvedValueOnce({ data: {}, status: 200 });
    await expect(submitSuspenseAdjustment(form)).rejects.toBe(failure);
    await expect(submitSuspenseAdjustment(form)).rejects.toThrow('Invalid suspense adjustment response');
  });

  it('reads leaf accounts with the finance book in a POST body', async () => {
    const accounts = { debitAccounts: [], creditAccounts: [] };
    jest.mocked(apiClient.post).mockResolvedValueOnce(accounts);
    await expect(getTxAccountsLeaf(4)).resolves.toBe(accounts);
    expect(apiClient.post).toHaveBeenCalledWith('/api/finance/v1/finance/reconciliation/tx/accounts/leaf', { financeBookId: 4 }, undefined);
  });

  it('adds, compares, subtracts and formats amounts without float rounding', () => {
    expect(calculateThisAdjustment([{ amount: '9007199254740993.01' }, { amount: '0.02' }])).toBe('9007199254740993.03');
    expect(calculateRemainingAfter('9007199254740993.03', '9007199254740993.02')).toBe('0.01');
    expect(calculateRemainingAfter('0.30', '0.31')).toBe('0');
    expect(calculateRemainingAfter('0.30', calculateThisAdjustment([{ amount: '0.10' }, { amount: '0.20' }]))).toBe('0');
    expect(amountExceeds('9007199254740993.01', '9007199254740993.00')).toBe(true);
    expect(formatAmount('9007199254740993.015', 'HKD')).toBe('9,007,199,254,740,993.02 HKD');
    for (const amount of ['0', '-1', '0.001', '1e2', 'Infinity']) expect(adjustmentEntryAmount(amount)).toBeNull();
  });
});
