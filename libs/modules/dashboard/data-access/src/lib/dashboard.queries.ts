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
    queryFn: async ({ signal }) => (await getStablecoinOptions({ signal })) ?? [],
  });
}

export function useStableCoinOverviewQuery() {
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: ({ signal }) => getStableCoinOverview({ signal }),
  });
}

export function useWalletStatisticsQuery(
  stablecoinCode: string,
  range: TimeRangeKey
) {
  const statisticsDateType = mapRangeToStatisticsDateType(range);

  return useQuery({
    queryKey: dashboardKeys.wallet(stablecoinCode, range),
    queryFn: ({ signal }) =>
      getWalletStatistics(
        {
          statisticsType: 1,
          statisticsDateType,
        },
        { signal }
      ),
    enabled: Boolean(stablecoinCode),
  });
}

export function useTransactionStatisticsQuery(
  stablecoinCode: string,
  range: TimeRangeKey
) {
  const statisticsDateType = mapRangeToStatisticsDateType(range);

  return useQuery({
    queryKey: dashboardKeys.transaction(stablecoinCode, range),
    queryFn: ({ signal }) =>
      getTransactionStatistics(
        {
          statisticsType: 2,
          statisticsDateType,
        },
        { signal }
      ),
    enabled: Boolean(stablecoinCode),
  });
}

function mapRangeToStatisticsDateType(range: TimeRangeKey): number {
  switch (range) {
    case '7d':
      return 1;
    case '14d':
      return 2;
    case '30d':
      return 3;
  }
}
