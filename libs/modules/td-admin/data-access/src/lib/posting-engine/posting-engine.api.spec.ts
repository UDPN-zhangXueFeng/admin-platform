import { apiClient, ApiError, axiosClient } from '@myorg/shared/data-access-api';
import { getPostingEventAccounts, getPostingHistoryList, updatePostingEvent } from './posting-engine.api';
import type { SavePostingEventDTO } from './posting-engine.model';

jest.mock('@myorg/shared/data-access-api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  axiosClient: { post: jest.fn() },
  ApiError: Error,
}));

const base = '/api/finance/v1/finance/posting';
const post = jest.mocked(axiosClient.post);
const dto: SavePostingEventDTO = {
  postingEventId: 253,
  eventCode: 'POST-1',
  eventType: 3,
  versionId: 'version-1',
  effectiveDate: 1_800_000_000_000,
  remarks: 'Keep existing remarks',
  mappings: [{
    postingEventId: 253, accountCode: '1001', accountName: 'Account - Main',
    direction: 1, mappingMethod: 2, amountExpression: '9007199254740993.1234567890123456', sortOrder: 1,
  }],
};

describe('posting engine wire contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([0, '0'])('accepts explicit success code %p without coercing the amount expression', async (code) => {
    post.mockResolvedValueOnce({ data: { code }, status: 200 });
    await expect(updatePostingEvent(dto)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith(`${base}/update`, dto, undefined);
    expect(JSON.stringify(post.mock.calls[0][1])).toContain('"amountExpression":"9007199254740993.1234567890123456"');
  });

  it.each([null, undefined, 1, ''])('does not accept a missing or nonzero success code %p', async (code) => {
    post.mockResolvedValueOnce({ data: { code }, status: 200 });
    await expect(updatePostingEvent(dto)).rejects.toBeInstanceOf(ApiError);
  });

  it('preserves the business rejection instead of resolving the mutation', async () => {
    const error = new Error('Effective version changed');
    post.mockRejectedValueOnce(error);
    await expect(updatePostingEvent(dto)).rejects.toBe(error);
  });

  it('uses directional GET params and normalizes absent account options', async () => {
    jest.mocked(apiClient.get).mockResolvedValue(null);
    await expect(getPostingEventAccounts(253, 1)).resolves.toEqual([]);
    await expect(getPostingEventAccounts(253, 2)).resolves.toEqual([]);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, `${base}/event-accounts/253`, { params: { direction: 1 } });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, `${base}/event-accounts/253`, { params: { direction: 2 } });
  });

  it('passes history page and status, and retains workflow aliases and the business code', async () => {
    jest.mocked(apiClient.post).mockResolvedValueOnce({ rows: [{ recordId: 11, taskID: '84', businessCode: 'PST' }] });
    const filters = { postingEventId: 253, status: 35 };
    const result = await getPostingHistoryList({ filters, pageNum: 2, pageSize: 10 });
    expect(result.rows[0]).toMatchObject({ id: '11', taskId: '84', busCode: 'PST' });
    expect(apiClient.post).toHaveBeenCalledWith(`${base}/history/list`, { data: filters, page: { pageNum: 2, pageSize: 10 } }, undefined);
  });
});
