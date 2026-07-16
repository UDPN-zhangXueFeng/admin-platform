// tokenized-deposit data-access barrel.
//
// 命名空间路径：@myorg/modules/tokenized-deposit/data-access
// 4 页面（overview/view/edit/t_edit）+ edit 组件群 19 文件 + coa-setup 共用
// model + api + keys/queries/mutations hooks。

// ── model（td-5，类型定义）──
// model.ts 全为 interface/type，用 export type * 做纯类型 re-export。
export type * from './lib/tokenized-deposit.model';

// ── api（td-6，41 endpoint + 2 补充 interface）──
// 含值导出（函数），用 export *。
export * from './lib/tokenized-deposit.api';

// ── keys（td-7，按 6 分组分 key）──
export { tdKeys } from './lib/+queries/tokenized-deposit.keys';

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
} from './lib/+queries/tokenized-deposit.queries';

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
} from './lib/+queries/tokenized-deposit.mutations';
