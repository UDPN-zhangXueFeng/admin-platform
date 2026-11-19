/**
 * Account-manage constants (access key / MetaMask wallet / 2FA cards).
 *
 * Upstream: td-manage `src/pages/account-manage/index.tsx` +
 * `components/register.tsx`. Labels are relative i18n keys inside the
 * `modules.account-manage` namespace (no namespace prefix).
 */

// ── MetaMask wallet status (`user/account/search` status) ───────────────────
// Source index.tsx: status === 0 renders Enabled, anything else Disabled.
export const METAMASK_STATUS_ENABLED = 0;
// Disable endpoint (`user/account/edit/status`) always sends status=1.
export const METAMASK_STATUS_DISABLED = 1;

// ── Wallet change history (`user/account/history`) ─────────────────────────
// Source drawer titles: operateType 2/3/4.
export const METAMASK_OPERATE_TYPE_LABEL: Record<number, string> = {
  2: 'account_manage_0040', // Updated Wallet Address on
  3: 'account_manage_0042', // Enabled MetaMask Wallet on
  4: 'account_manage_0043', // Disabled MetaMask Wallet on
};

// Operator prefix in the title template: "… on <time> by user <operateUser>".
export const METAMASK_OPERATE_USER_LABEL = 'account_manage_0041'; // by user

// Operation result: upstream treats status !== 1 as failure (0 is the actual
// backend value).
export const METAMASK_OPERATE_RESULT_LABEL: Record<number, string> = {
  0: 'account_manage_0044', // Fail
  1: 'account_manage_0045', // Success
};

// ── 2FA status (`user/two/factor/search` status) ───────────────────────────
// Opposite of the wallet: status === 1 means disabled (the card shows
// Disabled and the button offers Enable; `?type=1` opens the enable flow).
// Any other value is treated as enabled.
export const TWO_FACTOR_STATUS_DISABLED = 1;
