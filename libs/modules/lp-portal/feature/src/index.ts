/**
 * @myorg/modules/lp-portal/feature
 *
 * 真实页（R2）：pair / tx-flow（链路抽屉内嵌）/ settle / syslog（C4 日志）
 * / system user+menu（C1/C3）+ 跨页构件（PermButton、ServiceDownAlert、
 * format 工具）。
 * 真实页（R3）：system role（C2 角色管理：列表 + 角色/分配菜单弹窗）。
 * v2.3 e591f85：rate 页退役（汇率列并入 pair）、receipt 占位随上游路由
 * 退役删除；新增 Dashboard 落地页（统计卡 + 资金池 + 自绘折线 + 最近交易）。
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

// ── 会话页（A4 首登强制改密 / A8 个人中心）────────────────────────────
export { ChangePwdPage } from './lib/change-pwd-page';
export { ProfilePage } from './lib/profile-page';

// ── 资金池（B1 真实页 v2：单页列表 + 开池申请页内弹窗，无 create/edit/detail 子路由）───
export { PoolListPage } from './lib/pool-pages';

// ── 补资（B2 真实页：只读分页列表，无 create/detail 路由）──────────────

// 货币对与资金池（B4 真实页：单页主表+展开行聚合，无 create/detail 路由）
export { PairListPage } from './lib/pair-pages';

// Token 对管理（v2.3：汇率三列并入双 tab，rate 页退役）

// 交易流水（B5/B6 真实页：单页列表，链路 ChainDrawer 为页内构件经相对
// 路径消费，不入公共出口；源无 detail 路由）
export { TxFlowListPage } from './lib/tx-flow-pages';

// 结算（B7 真实页：单页双 tab（流水/结算单）独立分页独立筛选，无 detail 路由）
export { SettleListPage } from './lib/settle-pages';

// Dashboard（v2.3 登录落地页，lp:dashboard：统计卡四宫格 + 我的资金池 +
// Transaction Volume Statistics 自绘 SVG 折线 + 最近交易，只读无子路由）。
export { DashboardPage } from './lib/dashboard-pages';


// 操作日志（C4 真实页：只读分页，POST /lp/log/page，lp_id 后端注入）
export { SyslogListPage } from './lib/syslog-pages';

// 用户管理（C1 真实页：单页+弹窗交互，无 create/edit/detail 子路由）
export { UserListPage } from './lib/system-pages';
// 角色管理（C2 真实页，R3）：源为单页——新增/编辑/分配菜单均为页内弹窗，
// 无 create/edit/detail 路由；菜单分配树回显仅勾叶子 + 保存合并半选父。
export { RoleListPage } from './lib/role-pages';
// 菜单管理（C3 真实页：左树右表单单页，无子路由）
export { MenuListPage } from './lib/system-pages';
// 市场组（G2）：Token 总览（双 tab：平铺列表 + 按银行分组）。
export { TokenListPage } from './lib/token-pages';
// 流动性组（G3）：预授权监控（只读快照）+ 我的分成（双卡片）。
export { PreauthListPage } from './lib/preauth-pages';
export { SplitListPage } from './lib/split-pages';
// 壳层组（G6）：通知铃铛抽屉（lp-app-shell 经 AppShell trailing 插槽挂载）。
export { NotificationBellDrawer } from './lib/notification-bell-drawer';
export { ThemeSwitcher } from './lib/theme-switcher';
export type { ThemeSwitcherProps } from './lib/theme-switcher';
