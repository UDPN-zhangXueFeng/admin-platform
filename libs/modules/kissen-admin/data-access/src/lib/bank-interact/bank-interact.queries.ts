'use client';

/** Bank-interact domain read-query hooks. */
import { useQuery } from '@tanstack/react-query';

import { bankInteractKeys } from './bank-interact.keys';
import { interactView } from './bank-interact.api';

/** Peer rows for one bank (disabled until a bankId is provided). */
export function useInteractViewQuery(
  projectId: string,
  bankId: number | null | undefined,
) {
  return useQuery({
    queryKey: bankInteractKeys.view(projectId, bankId ?? 0),
    queryFn: ({ signal }) => interactView({ bankId: bankId ?? 0 }, { signal }),
    enabled: bankId != null,
  });
}
