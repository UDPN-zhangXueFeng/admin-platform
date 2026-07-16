'use client';

import { type ReactNode, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from './query-client';

/**
 * TanStack Query Provider for the React tree.
 *
 * Uses `useState(() => createQueryClient())` to guarantee a single
 * QueryClient instance per browser session. This pattern is required
 * in Next.js App Router to avoid sharing cache across SSR requests.
 *
 * Automatically mounts {@link ReactQueryDevtools} in development.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
