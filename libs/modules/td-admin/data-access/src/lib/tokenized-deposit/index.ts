// tokenized-deposit util barrel.
//
// 命名空间路径：.

export {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  RECON_DISABLED,
  RECON_ENABLED,
  MINT_METHOD,
  PLEDGE_TYPE,
  APPLY_STATUS,
  TD_STATE,
  TD_PERMISSIONS,
  TASK_STATUS_COLOR_KEY_PREFIX,
  TASK_STATUS_LABEL_KEY_PREFIX,
  SMART_CONTRACT_STATUS_COLOR_KEY_PREFIX,
  SMART_CONTRACT_STATUS_LABEL_KEY_PREFIX,
  RECORD_TYPE_KEY_PREFIX,
  OPERATION_RECORD_TYPE_KEY_PREFIX,
  ORDER_TYPE_KEY_PREFIX,
  TOKEN_TYPE_KEY_PREFIX,
  ADMIN_WALLET_TYPE_KEY_PREFIX,
  STEP_STATUS_KEY_PREFIX,
  ROLE_WALLET_STATUS_KEY_PREFIX,
  REVIEW_SUBMIT_STATE_KEY_PREFIX,
  STEP_STATUS_COLOR,
  STEP_STATUS_DEFAULT_COLOR,
  TD_STATE_ICON_COLOR,
  FUND_TYPE_MAP,
  RISK_LEVEL_MAP,
  COA_STATUS_STYLE,
  FINANCIAL_BOOK_NAME_PATTERN,
  FINANCIAL_BOOK_NAME_MAX_LENGTH,
  FINANCIAL_BOOK_NAME_RULE_MESSAGE,
  WALLET_ATTRIBUTE_TYPE,
  WALLET_ROLE,
} from './tokenized-deposit.constants';

export {
  getEncryptionData,
} from './get-encryption-data';

export {
  REQUIRED_COA_SETUP_FIELDS,
  setupRequiredCoaSetupMock,
  getCoaTemplateTokenType,
  mapFinanceBookToCoaSetup,
  mapDetailToCoaSetup,
  withDefaultAccountTemplate,
  withDefaultCoaTimezone,
  resolveCoaSetupTimeZone,
  normalizeCoaSetupTimeZone,
  mapCoaSetupToPayload,
  getCoaSetupFieldError,
  validateCoaSetup,
  hasCoaSetupErrors,
  getNextCoaSetupErrors,
} from './coa-setup-utils';

export {
  saveDraft,
  loadDraft,
  clearDraft,
  formatDraftTime,
  draftKey,
} from './onboard-draft';
export type {
  OnboardDraft,
  OnboardDraftFormValues,
  OnboardDraftCoaInfo,
  OnboardDraftCoaValues,
  DraftScope,
} from './onboard-draft';
// tokenized-deposit data-access barrel.
//
// 命名空间路径：.
// 4 页面（overview/view/edit/t_edit）+ edit 组件群 19 文件 + coa-setup 共用
// model + api + keys/queries/mutations hooks。

// ── model（td-5，类型定义）──
// model.ts 全为 interface/type，用 export type * 做纯类型 re-export。
export type * from './tokenized-deposit.model';

// ── api（td-6，41 endpoint + 2 补充 interface）──
// 含值导出（函数），用 export *。
export * from './tokenized-deposit.api';

// ── keys（td-7，按 6 分组分 key）──
export {
  tdKeys,
} from './+queries/tokenized-deposit.keys';

// ── queries（td-7，TanStack Query 只读 hooks）──
export {
  // 1. 列表查询（keepPreviousData）
  useTDRecordQuery,
  useSPRecordQuery,
  useWalletQuery,
  useWalletBalanceQuery,
  useWalletDetailListQuery,
  useWalletHistoryListQuery,
  useOperationRecordQuery,
  useMMFSummaryQuery,
  useStablecoinRecordQuery,
  // 2. 详情 / 标题查询（enabled 守卫）
  useApplyListQuery,
  useStablecoinListQuery,
  useStablecoinInfoQuery,
  useContractPackageQuery,
  useContractDetailQuery,
  useContractDeployHistoryQuery,
  useDeployStepDetailQuery,
  useReserveBalanceQuery,
  useHasPendingMeltQuery,
  // 3. 编辑页子查询（enabled 守卫）
  useTDOperationEditDetailQuery,
  useKeyServiceListQuery,
  useAdminWalletListQuery,
  useFinanceTemplateQuery,
  useFinanceBookByReserveQuery,
  useReserveListQuery,
  // 4. 公共下拉（select filterDropdown + staleTime 5min）
  useBlockchainOptionsQuery,
  useCurrencyOptionsQuery,
  useTokenTypeOptionsQuery,
  useTimezoneOptionsQuery,
  useSmartContractOptionsQuery,
  // 5. role-wallet（mock）
  useRoleWalletsListQuery,
  useRoleWalletDetailQuery,
} from './+queries/tokenized-deposit.queries';

// ── mutations（td-7，TanStack Query 写操作 hooks）──
export {
  useSubmitMintMeltMutation,
  useIssueStablecoinMutation,
  useRemoveStablecoinMutation,
  useDeployContractMutation,
  useUpdateTDStatusMutation,
  useDeleteTDMutation,
  useUpdateAdminWalletMutation,
  useApprovalAdminWalletMutation,
  useGenerateWalletKeystoreMutation,
  useCreateTDApplyMutation,
  useEditTDOperationMutation,
  useConfigureRoleWalletMutation,
} from './+queries/tokenized-deposit.mutations';
