import type { TimeRangeKey } from './dashboard.model';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: () => [...dashboardKeys.all, 'overview'] as const,
  stablecoins: () => [...dashboardKeys.all, 'stablecoins'] as const,
  wallet: (stablecoinCode: string, range: TimeRangeKey) =>
    [...dashboardKeys.all, 'wallet', stablecoinCode, range] as const,
  transaction: (stablecoinCode: string, range: TimeRangeKey) =>
    [...dashboardKeys.all, 'transaction', stablecoinCode, range] as const,
};
