// cross-chain feature barrel.
//
// 占位：cc-16 填充 5 个子模块 manifest（rd-bridge / liquidity-pool / token-pair
// / cross-chain-transactions / fx-rate）+ 各页面（list/detail/edit）。
// 对齐 blockchain feature 结构（group 容器：每子模块各自 manifest，id=子模块名）。
// 命名空间路径：@myorg/modules/cross-chain/feature

// cc-7：liquidity-pool Reauthorize/TransferOut 共用动态 Modal。
// 由 cc-14（liquidity-pool-list-page）行操作调用。
export { LiquidityPoolActionModal } from './lib/liquidity-pool-action-modal';
export type {
  LiquidityPoolAction,
  LiquidityPoolModalInfo,
  LiquidityPoolActionModalProps,
} from './lib/liquidity-pool-action-modal';

// cc-14：liquidity-pool 列表（5 筛选 + 顶部新增跳 edit + 行操作
// 查看/编辑(status∈{0,5})/重新授权(status===5)/转出(status===5) 调 ActionModal）
// + 详情（4 Tabs：基本信息 Descriptions / transactions 表 / authorization 表 / operationRecords 表）。
export { LiquidityPoolListPage } from './lib/liquidity-pool-list-page';
export { LiquidityPoolDetailPage } from './lib/liquidity-pool-detail-page';

// cc-8：fx-rate 列表 + 详情（详情用 DataTable 呈现历史汇率分页，非常规 Descriptions）。
export { FxRateListPage } from './lib/fx-rate-list-page';
export { FxRateDetailPage } from './lib/fx-rate-detail-page';

// cc-9：cross-chain-transactions 列表（6 筛选）+ 详情（Steps 时间线按 index 分支）。
export { CrossChainTransactionsListPage } from './lib/cross-chain-transactions-list-page';
export { CrossChainTransactionsDetailPage } from './lib/cross-chain-transactions-detail-page';

// cc-10：rd-bridge 列表（7 筛选 + isTokenPaired 拦截 + Disable/Enable Modal）
// + 详情（2 Tabs：基本信息 3 组 Descriptions + 操作记录表 + Drawer CustomInformation）。
export { RdBridgeListPage } from './lib/rd-bridge-list-page';
export { RdBridgeDetailPage } from './lib/rd-bridge-detail-page';

// cc-11：rd-bridge 注册/编辑共用页（query.id 区分；链 Select + endpointId + 3 合约地址
// hex 校验 + 4 监控字段 + notifyEmail 批量校验 + Checkbox 拉全员邮箱；onFinish 分支 save/edit）。
export { RdBridgeEditPage } from './lib/rd-bridge-edit-page';

// cc-12：token-pair 列表（6 筛选 + 方向色块 + Disable/Enable 共用 Modal 调 update 35/50）
// + 详情（2 Tabs：左右两栏 CustomInformation + 中间图标 / 操作记录表行查看跳 approval-manage/view）
// + 编辑（send/receive 联动 + latestSendTokenIdRef 竞态保护 + 自动选 receive[0] 填充 +
//   编辑态仅 crossChainFee 可改 + 无流动性池提示跳转）。
export { TokenPairListPage } from './lib/token-pair-list-page';
export { TokenPairDetailPage } from './lib/token-pair-detail-page';
export { TokenPairEditPage } from './lib/token-pair-edit-page';

// cc-16：5 个子模块 manifest（group 机制：group 容器不进 registry，每子模块各自 manifest，
// id=子模块名，routes component 用通用 key list/detail/edit）。对齐 blockchain feature 结构。
// 由 apps 的 module-registry 按 realModule（子模块名）加载对应 manifest。
export {
  crossChainTransactionsManifest,
  fxRateManifest,
  liquidityPoolManifest,
  rdBridgeManifest,
  tokenPairManifest,
} from './lib/module-manifest';

// cc-15：liquidity-pool 新增/编辑共用页（query.id 区分；tokenId Select 联动
// symbol/decimalPrecision/blockName + liquidityPoolWalletAddress(hex 校验+生成钱包入口) +
// deductibleAmount(小数位 validator) + keystore/keystorePassword(AES 加密，编辑态未改原样传) +
// threshold + emailRecipients(批量校验≤20+Checkbox 拉全员邮箱)；生成钱包抽 use-generate-wallet hook
// 校验→覆盖确认 AlertDialog→Modal password→AES→wallet/keystore(chainType 按 blockName)→回填；onFinish 分支 save/edit）。
export { LiquidityPoolEditPage } from './lib/liquidity-pool-edit-page';
