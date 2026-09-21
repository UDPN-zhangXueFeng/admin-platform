import { QueryClient } from '@tanstack/react-query';

/**
 * Determines whether a failed query should be retried.
 *
 * Retry policy:
 * - Only retry on 5xx server errors (indicating transient failures).
 * - Do NOT retry on 4xx client errors (the request itself is invalid).
 * - Maximum 2 retry attempts.
 */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  // Check for ApiError (normalised by axios response interceptor)
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  ) {
    const status = (error as Record<string, unknown>).status as number;
    return status >= 500 && status < 600;
  }

  // Unknown errors (network, timeout) are treated as retryable
  return true;
}

/**
 * Factory for creating a {@link QueryClient} with shared defaults.
 *
 * Defaults:
 * - `staleTime`: 30 seconds — data considered fresh for 30s to reduce refetching
 * - `gcTime`: 5 minutes — inactive cache kept for 5min before garbage collection
 * - `refetchOnWindowFocus`: false — avoid disruptive refetches on tab switch
 * - `retry`: only on 5xx, up to 2 times
 * - Mutations never retry
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
