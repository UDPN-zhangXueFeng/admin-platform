'use client';

import * as React from 'react';
import { Badge } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

/**
 * tone → Tailwind badge class（对齐 approval-manage TONE_CLASS 范式）。
 * 覆盖 reconciliation real-time(1-6)/reserve(0-5) 状态色调。
 */
const TONE_CLASS: Record<string, string> = {
  default: 'border-gray-200 bg-gray-50 text-gray-600',
  secondary: 'border-gray-200 bg-gray-50 text-gray-600',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  destructive: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
};

export interface StatusBadgeProps extends React.ComponentProps<'span'> {
  tone?: string;
  children?: React.ReactNode;
}

/**
 * Reconciliation 状态 badge。tone → tailwind class，未知回落 default。
 * 取色真源：util `RECON_STATUS_TONE` / `RESERVE_STATUS_TONE` → 传入 tone。
 */
export function StatusBadge({
  tone,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        TONE_CLASS[tone ?? 'default'] ?? TONE_CLASS.default,
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}
