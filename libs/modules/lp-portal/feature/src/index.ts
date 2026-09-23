/**
 * @myorg/modules/lp-portal/feature
 *
 * 真实页（R2）：pair / tx-flow（链路抽屉内嵌）/ settle / syslog（C4 日志）
 * / system user+menu（C1/C3）+ 跨页构件（PermButton、ServiceDownAlert、
 * format 工具）。
 * 真实页（R3）：system role（C2 角色管理：列表 + 角色/分配菜单弹窗）。
 * v2.3 e591f85：rate 页退役（汇率列并入 pair）、receipt 占位随上游路由
 * 退役删除；新增 Dashboard 落地页。
 * v2.4 6c49396：preauth/split/settle 三页退役，合并为 split-settle
 * 单页（分成与结算）；dashboard 删最近交易、折线双维度。
 */
// ── 跨页构件 ──────────────────────────────────────────────────────────
// A6 v-perm 等价（无 key 时移除按钮）
export { usePerm, PermButton, type PermButtonProps } from './lib/perm-button';
// A7 页面级降级条（MSG_23_0024，保留旧数据、无全局 toast）
export {
  ServiceDownAlert,
  type ServiceDownAlertProps,
} from './lib/service-down-alert';
// B8 格式化工具（金额不归一/时间戳/地址掩码，口径同源）
export { formatTime, formatMoney, maskAddress } from './lib/format';

// ── 原型口径公共件（方案 12 §3 P0：format / 枚举映射 / Dash / CopyableId /
// ActionConfirmDialog / ProtoStatusBadge，供逐页改造消费）──────────────────
export {
  formatUtc8,
  formatRate,
  formatTokenAmount,
  formatPercent,
  formatDuration,
} from './lib/proto-format';
export {
  Dash,
  CopyableId,
  ActionConfirmDialog,
  ProtoStatusBadge,
  type ActionConfirmDialogProps,
  type ProtoTone,
} from './lib/proto-ui';
export {
  LP_TX_STATUS_MAP,
  LP_POOL_STATUS_MAP,
  LP_PAIR_STATUS_MAP,
  LP_PAIR_READINESS_MAP,
  lpPairReadinessKey,
  LP_STATEMENT_STATUS_MAP,
  LP_USER_STATUS_MAP,
  LP_ROLE_STATUS_MAP,
  LP_LOG_RESULT_MAP,
  type ProtoEnumEntry,
  type LpPairReadinessKey,
} from './lib/proto-enums';

// ── 会话页（A4 首登强制改密 / A8 个人中心）────────────────────────────
export { ChangePwdPage } from './lib/change-pwd-page';
export { ProfilePage } from './lib/profile-page';
// 邀请落地页（v2.1 a522963：免登录 (auth) 路由，?token= 一次性邀请）
export { InviteAcceptPage } from './lib/invite-accept-page';

// ── 资金池（P1 原型对齐：列表 + Details 详情页 ?poolId=，详情经
// /pool/detail 注册渲染，无 create/edit 子路由）───
export { PoolListPage } from './lib/pool-pages';
export { PoolDetailPage } from './lib/pool-pages';

// ── 补资（B2 真实页：只读分页列表，无 create/detail 路由）──────────────

// 货币对与资金池（B4 真实页：单页主表+展开行聚合，无 create/detail 路由）
export { PairListPage } from './lib/pair-pages';

// Token 对管理（v2.3：汇率三列并入双 tab，rate 页退役）

// 交易流水（B5/B6 + P1 原型对齐：列表 + ?txNo= 交易详情页（清分管线
// 7 段可视化）；ChainDrawer/tx-chain 为页内构件经相对路径消费，不入公共出口）
export { TxFlowListPage, FxTransactionDetailPage } from './lib/tx-flow-pages';

// 分成与结算（v2.4 6c49396 合并页：当前生效比例 + 分成明细 + 结算单三页签
// + ?statementNo= 结算单详情页（分项 + 本单流水）；取代原 split/settle/
// preauth 三页）
export {
  SplitSettlePage,
  SettlementStatementDetailPage,
} from './lib/split-settle-pages';

// Dashboard（P1 原型对齐落地页：页头 As of/Refresh + 告警横幅 + KPI 四宫格 +
// 我的资金池水位卡 + 交易量柱状图 + 营收结算静态补齐 + 币对/交易双 Tab，只读
// 无子路由；补齐口径见 GAP-LP-01）。
export { DashboardPage } from './lib/dashboard-pages';

// 操作日志（P1 原型对齐：列表 + /syslog/detail?logId= 详情页；详情数据经
// sessionStorage 行暂存（GAP-LP-10 无 /log/:id 端点），深链无暂存落 not-found）
export { SyslogListPage, SyslogDetailPage } from './lib/syslog-pages';

// 用户管理（P1 原型对齐：列表 + create/edit 共用表单页 + detail 详情页；
// 创建成功弹 Initial Password OTP，启停/重置密码/强制下线/Assign Roles 弹窗保留）
export { UserListPage, UserFormPage, UserDetailPage } from './lib/system-pages';
// 角色管理（P1 原型对齐：列表 + /sys/role/detail?roleCode= 详情页；编辑走
// RoleFormDialog 弹窗，Assign Menus 为详情页抽屉（?assignMenus=1 直达），
// 授权载体 menuIds（GAP-LP-13），树回显仅勾叶子 + 保存合并半选父）
export { RoleListPage, RoleDetailPage } from './lib/role-pages';
// 菜单管理（P1 原型对齐：左树右表单单页 + 树过滤；无子路由）
export { MenuListPage } from './lib/system-pages';
// 市场组（G2）：Token 总览（双 tab：平铺列表 + 按银行分组）。
export { TokenListPage } from './lib/token-pages';
// 流动性组（G3）：v2.4 6c49396——preauth 监控页与我的分成独立页退役，
// 行为并入 split-settle 合并页与 pool/Dashboard 的预授权列。
// 壳层组（G6）：通知铃铛抽屉（lp-app-shell 经 AppShell trailing 插槽挂载）。
export { NotificationBellDrawer } from './lib/notification-bell-drawer';
export { ThemeSwitcher } from './lib/theme-switcher';
export type { ThemeSwitcherProps } from './lib/theme-switcher';
