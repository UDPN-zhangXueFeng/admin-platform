'use client';

import * as React from 'react';
import { WorkflowStatus } from '@myorg/modules/workflow/util';

export interface WorkflowStatusTagProps {
  /** 1 启用 / 2 禁用 / 3 已删除（util/workflow.constants.ts）。 */
  status: number;
  /** 启用态文案。 */
  activeLabel: string;
  /** 禁用态文案。 */
  inactiveLabel: string;
}

/**
 * 工作流状态标签。status→label/color（对齐旧页 Tag 配色：1 绿 / 其他灰）。
 *
 * 文案由调用方经 i18n 传入（ui 层不直接依赖 next-intl，保持纯展示组件）。
 * 列表筛选只暴露 1/2，但 status 也可能为 3（已删除），统一按「非启用」灰色渲染。
 */
export function WorkflowStatusTag({
  status,
  activeLabel,
  inactiveLabel,
}: WorkflowStatusTagProps) {
  const isActive = status === WorkflowStatus.Active;

  const className = isActive
    ? 'inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20'
    : 'inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20';

  return (
    <span className={className}>{isActive ? activeLabel : inactiveLabel}</span>
  );
}
