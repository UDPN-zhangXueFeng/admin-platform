import { useTokenTypeListQuery } from '@myorg/modules/td-admin/data-access/lib/blockchain/+queries/blockchain.queries';
import { TOKEN_TYPE_VALUES } from '../reconciliation.constants';

export function useRealTimeTokenTypes() {
  const { data } = useTokenTypeListQuery();
  return data?.filter(({ tokenTypeId }) => TOKEN_TYPE_VALUES.has(Number(tokenTypeId))) ?? [];
}
