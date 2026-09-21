'use client';

/**
 * UserStatusBadge — 用户状态标签。
 *
 * status→label/color（user.md §5.1：0 正常 绿 / 1 禁用 灰）。文案由调用方经
 * i18n 传入（ui 层不直接依赖 next-intl，保持纯展示组件，与 RoleStatusTag 一致）。
 */

export interface UserStatusBadgeProps {
  /** 0 正常 / 1 禁用（user.md §4.1）。 */
  status: number;
  /** 正常态文案。 */
  enabledLabel: string;
  /** 禁用态文案。 */
  disabledLabel: string;
}

export function UserStatusBadge({
  status,
  enabledLabel,
  disabledLabel,
}: UserStatusBadgeProps) {
  const isEnabled = status === 0;

  const className = isEnabled
    ? 'inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20'
    : 'inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20';

  return (
    <span className={className}>{isEnabled ? enabledLabel : disabledLabel}</span>
  );
}
