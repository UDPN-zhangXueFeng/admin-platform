'use client';

import * as React from 'react';
import { RoleStatus, type RoleStatusValue } from '@myorg/modules/role/util';

export interface RoleStatusTagProps {
  /** 0 启用 / 1 禁用（role.md 7.4）。 */
  status: number;
  /** 启用态文案。 */
  enabledLabel: string;
  /** 禁用态文案。 */
  disabledLabel: string;
}

/**
 * 角色状态标签。status→label/color（role.md 5.2：0 绿 / 其他灰）。
 *
 * 文案由调用方经 i18n 传入（ui 层不直接依赖 next-intl，保持纯展示组件）。
 */
export function RoleStatusTag({
  status,
  enabledLabel,
  disabledLabel,
}: RoleStatusTagProps) {
  const isEnabled = status === RoleStatus.Enabled;

  const className = isEnabled
    ? 'inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20'
    : 'inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20';

  return (
    <span className={className}>{isEnabled ? enabledLabel : disabledLabel}</span>
  );
}

/** 类型辅助：导出 status 联合类型，供 feature 层复用。 */
export type { RoleStatusValue };
