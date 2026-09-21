/**
 * Account-manage 模块常量（访问密钥 / MetaMask 钱包 / 2FA 三卡片）。
 *
 * 上游：td-manage `src/pages/account-manage/index.tsx` + `components/register.tsx`。
 * label 为 i18n 相对 key（`modules.account-manage` 命名空间内，不带前缀）。
 */

// ── MetaMask 钱包状态（user/account/search 的 status）──────────────────────
// 源 index.tsx：status === 0 显示 Enabled，其余显示 Disabled
export const METAMASK_STATUS_ENABLED = 0;
// 停用钱包接口（user/account/edit/status）固定入参 status=1
export const METAMASK_STATUS_DISABLED = 1;

// ── 钱包变更历史（user/account/history）───────────────────────────────────
// 源 index.tsx 抽屉标题：operateType 2/3/4 三种操作文案
export const METAMASK_OPERATE_TYPE_LABEL: Record<number, string> = {
  2: 'account_manage_0040', // Updated Wallet Address on
  3: 'account_manage_0042', // Enabled MetaMask Wallet on
  4: 'account_manage_0043', // Disabled MetaMask Wallet on
};

// 标题模板中的操作人前缀：“… on <time> by user <operateUser>”
export const METAMASK_OPERATE_USER_LABEL = 'account_manage_0041'; // by user

// 操作结果：上游判定 status !== 1 均为失败（0 为后端实际回传值）
export const METAMASK_OPERATE_RESULT_LABEL: Record<number, string> = {
  0: 'account_manage_0044', // Fail
  1: 'account_manage_0045', // Success
};

// ── 2FA 状态（user/two/factor/search 的 status）────────────────────────────
// 与钱包相反：status === 1 → 已停用（卡片显示 Disabled、按钮为 Enable，
// 注册页 ?type=1 走启用流程），其余值视为已启用
export const TWO_FACTOR_STATUS_DISABLED = 1;
