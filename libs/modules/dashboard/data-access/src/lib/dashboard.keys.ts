import type { TimeRangeKey } from './dashboard.model';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: (stablecoinCode: string) =>
    [...dashboardKeys.all, 'overview', stablecoinCode] as const,
  stablecoins: () => [...dashboardKeys.all, 'stablecoins'] as const,
  wallet: (stablecoinCode: string, range: TimeRangeKey) =>
    [...dashboardKeys.all, 'wallet', stablecoinCode, range] as const,
  transaction: (stablecoinCode: string, range: TimeRangeKey) =>
    [...dashboardKeys.all, 'transaction', stablecoinCode, range] as const,
};
