import { apiClient } from '@myorg/shared/data-access-api';
import {
  getStableCoinOverview,
  getTransactionStatistics,
  getWalletStatistics,
} from './dashboard.api';

jest.mock('@myorg/shared/data-access-api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const post = apiClient.post as jest.Mock;

describe('dashboard API contract', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue([]);
  });

  it('uses the selected stablecoin code for the overview instead of the global statistics endpoint', async () => {
    await getStableCoinOverview('td-usdc');

    expect(post).toHaveBeenCalledWith(
      '/api/manage/v1/td/dashboard/stablecoin/statistics',
      { stablecoinCode: 'td-usdc' },
      undefined,
    );
  });

  it('sends the backend-required code and timestamp range to both trend endpoints', async () => {
    const payload = {
      stablecoinCode: 'td-usdc',
      startTime: 1_720_000_000_000,
      endTime: 1_720_604_800_000,
    };

    await getWalletStatistics(payload);
    await getTransactionStatistics(payload);

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/manage/v1/td/dashboard/wallet/statistics',
      payload,
      undefined,
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/manage/v1/td/dashboard/transaction/statistics',
      payload,
      undefined,
    );
  });
});
