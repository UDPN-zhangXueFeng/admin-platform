/**
 * @myorg/modules/lp-portal/feature
 *
 * LP Portal feature lib —— Mock 模式下提供全部模块页面组件。
 * 所有数据均为硬编码 mock，无任何 API 调用。
 *
 * 导出对应 §5.3 的 14 个模块的全部页面键（list / create / edit / detail），
 * create / edit 统一复用各自的 FormPage 组件。
 */

// 工作台
export { DashboardPage } from './lib/dashboard-page';

// 资金池管理
export {
  PoolListPage,
  PoolDetailPage,
  PoolFormPage,
} from './lib/pool-pages';

// 预授权管理
export {
  PreauthListPage,
  PreauthDetailPage,
  PreauthFormPage,
} from './lib/preauth-pages';

// 补资
export {
  TopupListPage,
  TopupFormPage,
  TopupDetailPage,
} from './lib/topup-pages';

// 货币对与资金池
export { PairListPage, PairDetailPage } from './lib/pair-pages';

// 汇率
export { RateListPage } from './lib/rate-pages';

// 交易流水
export { TxFlowListPage, TxFlowDetailPage } from './lib/tx-flow-pages';

// 结算
export { SettleListPage, SettleDetailPage } from './lib/settle-pages';

// 源端收款明细
export { ReceiptListPage, ReceiptDetailPage } from './lib/receipt-pages';

// 通知中心
export { NotifyListPage } from './lib/notify-pages';

// 操作日志
export { SyslogListPage } from './lib/syslog-pages';

// 系统管理（user / role / menu）
export {
  UserListPage,
  UserDetailPage,
  UserFormPage,
  RoleListPage,
  RoleDetailPage,
  RoleFormPage,
  MenuListPage,
} from './lib/system-pages';
