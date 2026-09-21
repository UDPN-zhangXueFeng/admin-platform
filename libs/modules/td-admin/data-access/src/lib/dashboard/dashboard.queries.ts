'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getStableCoinOverview,
  getStablecoinOptions,
  getTransactionStatistics,
  getWalletStatistics,
} from './dashboard.api';
import type { TimeRangeKey } from './dashboard.model';
import { dashboardKeys } from './dashboard.keys';

export function useStablecoinOptionsQuery() {
  return useQuery({
    queryKey: dashboardKeys.stablecoins(),
    queryFn: async ({ signal }) =>
      (await getStablecoinOptions({ signal })) ?? [],
  });
}

export function useStableCoinOverviewQuery(stablecoinCode: string) {
  return useQuery({
    queryKey: dashboardKeys.overview(stablecoinCode),
    queryFn: ({ signal }) => getStableCoinOverview(stablecoinCode, { signal }),
    enabled: Boolean(stablecoinCode),
  });
}

export function useWalletStatisticsQuery(
  stablecoinCode: string,
  range: TimeRangeKey,
) {
  const timeRange = getTrendTimeRange(range);

  return useQuery({
    queryKey: dashboardKeys.wallet(stablecoinCode, range),
    queryFn: ({ signal }) =>
      getWalletStatistics(
        {
          stablecoinCode,
          ...timeRange,
        },
        { signal },
      ),
    enabled: Boolean(stablecoinCode),
  });
}

export function useTransactionStatisticsQuery(
  stablecoinCode: string,
  range: TimeRangeKey,
) {
  const timeRange = getTrendTimeRange(range);

  return useQuery({
    queryKey: dashboardKeys.transaction(stablecoinCode, range),
    queryFn: ({ signal }) =>
      getTransactionStatistics(
        {
          stablecoinCode,
          ...timeRange,
        },
        { signal },
      ),
    enabled: Boolean(stablecoinCode),
  });
}

function getTrendTimeRange(range: TimeRangeKey): {
  startTime: number;
  endTime: number;
} {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const rangeDays = range === '7d' ? 7 : range === '14d' ? 14 : 30;

  return {
    endTime: end.getTime(),
    startTime: end.getTime() - rangeDays * 24 * 60 * 60 * 1000,
  };
}
