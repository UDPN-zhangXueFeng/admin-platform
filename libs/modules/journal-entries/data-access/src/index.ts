// journal-entries data-access barrel.

// ── model ──
export type {
  ResultPageInfo,
  BillRule,
  BillRuleListFilters,
  BillRuleListParams,
  BillRuleListResponse,
  LoanRule,
  TxTypeRule,
  BillRuleDetail,
  BillTokenOption,
  BillSubject,
  InterestTxType,
  BillTxItem,
  BillTxListFilters,
  BillTxListParams,
  BillTxListResponse,
  OperateBillRuleDTO,
  SaveBillRuleDTO,
  SaveSubjectDTO,
  ExportBillTxReq,
  StablecoinSearchOption,
  BlockchainOption,
  CurrencyOption,
} from './lib/journal-entries.model';

// ── api ──
export {
  getBillRuleList,
  operateBillRule,
  getBillRuleDetail,
  addBillRule,
  editBillRule,
  getBillSubjectList,
  saveBillSubject,
  getBillTokenList,
  getInterestTxType,
  getBillTxList,
  getBillTxType,
  createBillExportTask,
  getStablecoinSearches,
  getBlockchainList,
  getCurrencyList,
} from './lib/journal-entries.api';

// ── queries ──
export { journalEntriesKeys } from './lib/+queries/journal-entries.keys';
export {
  useBillRuleListQuery,
  useBillRuleDetailQuery,
  useBillTokenListQuery,
  useBillSubjectListQuery,
  useInterestTxTypeQuery,
  useBillTxListQuery,
  useBillTxTypeQuery,
  useOperateBillRuleMutation,
  useSaveBillRuleMutation,
  useSaveBillSubjectMutation,
  useCreateBillExportTaskMutation,
  useStablecoinSearchesQuery,
  useBlockchainListQuery,
  useCurrencyListQuery,
} from './lib/+queries/journal-entries.queries';
