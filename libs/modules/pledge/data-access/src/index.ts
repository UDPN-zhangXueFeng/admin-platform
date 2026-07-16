// pledge data-access barrel.
//
// 命名空间路径：@myorg/modules/pledge/data-access
// 2 子模块（asset-transaction / reserve-asset-list）共用 model + api + keys/queries/mutations。

// ── model ──
export type {
  ResultPageInfo,
  ApiResponse,
  PageResult,
  // 下拉选项
  CurrencyOption,
  BankOption,
  AssetCategoryOption,
  AssetCategory,
  TokenOverview,
  // 列表行
  ReserveAssetListItem,
  ReserveAssetListQuery,
  ReserveAssetListResponse,
  // 详情
  ReserveAssetDetail,
  ReserveAssetDetailReq,
  // 交易
  ReserveAssetTxn,
  ReserveAssetTxnListQuery,
  ReserveAssetTxnListResponse,
  // 操作记录
  OperateRecord,
  OperateRecordQuery,
  OperateRecordResponse,
  // 资产类别
  AssetCategoryListQuery,
  // 资产下拉（无分页）
  ReserveAssetOptionList,
  // 表单值类型
  DrawerAddForm,
  DrawerEditForm,
  AssetCategoryAddForm,
  AssetTransactionCreateForm,
  // 写操作请求体
  AddReserveAssetReq,
  EditReserveAssetReq,
  ChangeReserveAssetStatusReq,
  AddAssetCategoryReq,
  AssetTransactionCreateReq,
} from './lib/pledge.model';

// ── api（13 个，死代码 7 个已排除）──
export {
  // 列表（2）
  getReserveAssetListPage,
  getReserveAssetTxList,
  // 详情（2）
  getReserveAssetDetail,
  getOperateRecordListPage,
  // 写操作（5）
  addReserveAsset,
  editReserveAsset,
  changeReserveAssetStatus,
  addAssetCategory,
  saveReserveAssetTx,
  // 下拉/子查询（4）
  getReserveAssetOptions,
  getAssetCategoryList,
  getCurrencyList,
  getBankList,
} from './lib/pledge.api';

// ── keys ──
export { pledgeKeys } from './lib/+queries/pledge.keys';

// ── queries ──
export {
  // 列表
  useReserveAssetListQuery,
  useReserveAssetTxListQuery,
  // 详情
  useReserveAssetDetailQuery,
  useOperateRecordListQuery,
  // 下拉
  useReserveAssetOptionsQuery,
  useAssetCategoryListQuery,
  useCurrencyListQuery,
  useBankListQuery,
} from './lib/+queries/pledge.queries';

// ── mutations ──
export {
  useAddReserveAssetMutation,
  useEditReserveAssetMutation,
  useChangeReserveAssetStatusMutation,
  useAddAssetCategoryMutation,
  useSaveReserveAssetTxMutation,
} from './lib/+queries/pledge.mutations';
