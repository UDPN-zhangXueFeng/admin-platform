import type {
  BillRuleListParams,
  BillTxListParams,
} from '../journal-entries.model';

/** TanStack Query key 工厂。 */
export const journalEntriesKeys = {
  all: ['journal-entries'] as const,
  rules: () => [...journalEntriesKeys.all, 'rules'] as const,
  ruleList: (params: BillRuleListParams) =>
    [...journalEntriesKeys.rules(), 'list', params] as const,
  ruleDetail: (ruleId: number | string) =>
    [...journalEntriesKeys.rules(), 'detail', ruleId] as const,
  tokenList: () => [...journalEntriesKeys.rules(), 'token-list'] as const,
  subjectList: (stablecoinId: number | string) =>
    [...journalEntriesKeys.rules(), 'subject-list', stablecoinId] as const,
  interestTxType: (stablecoinId: number | string) =>
    [...journalEntriesKeys.rules(), 'interest-tx-type', stablecoinId] as const,
  tx: () => [...journalEntriesKeys.all, 'tx'] as const,
  txList: (params: BillTxListParams) =>
    [...journalEntriesKeys.tx(), 'list', params] as const,
  txType: (stablecoinId: number | string) =>
    [...journalEntriesKeys.tx(), 'type', stablecoinId] as const,
  stablecoinSearches: () =>
    [...journalEntriesKeys.all, 'stablecoin-searches'] as const,
  blockchainList: () => [...journalEntriesKeys.all, 'blockchain-list'] as const,
  currencyList: () => [...journalEntriesKeys.all, 'currency-list'] as const,
} as const;
