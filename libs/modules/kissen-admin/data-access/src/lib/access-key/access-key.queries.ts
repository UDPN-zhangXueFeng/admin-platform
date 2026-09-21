'use client';

/** Access-key domain read-query hooks. */
import { useQuery } from '@tanstack/react-query';

import { accessKeyKeys } from './access-key.keys';
import { accessKeyList } from './access-key.api';

/** Ledger for one bank, newest last (disabled until a bankId is provided). */
export function useAccessKeyListQuery(
  projectId: string,
  bankId: number | null | undefined,
) {
  return useQuery({
    queryKey: accessKeyKeys.list(projectId, { bankId: bankId ?? 0 }),
    queryFn: ({ signal }) => accessKeyList({ bankId: bankId ?? 0 }, { signal }),
    enabled: bankId != null,
  });
}
