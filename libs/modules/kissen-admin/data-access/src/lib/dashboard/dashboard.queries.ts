'use client';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardSummary,
  getDashboardPairDist,
  getDashboardTrend,
} from './dashboard.api';

const dashboardKeys = (projectId: string) =>
  ['project', projectId, 'dashboard'] as const;
export function useDashboardSummaryQuery(projectId: string) {
  return useQuery({
    queryKey: [...dashboardKeys(projectId), 'summary'],
    queryFn: ({ signal }) => getDashboardSummary({ signal }),
  });
}
export function useDashboardPairDistQuery(projectId: string, days: number) {
  return useQuery({
    queryKey: [...dashboardKeys(projectId), 'pair', days],
    queryFn: ({ signal }) => getDashboardPairDist(days, { signal }),
  });
}
export function useDashboardTrendQuery(projectId: string, days: number) {
  return useQuery({
    queryKey: [...dashboardKeys(projectId), 'trend', days],
    queryFn: ({ signal }) => getDashboardTrend(days, { signal }),
  });
}
