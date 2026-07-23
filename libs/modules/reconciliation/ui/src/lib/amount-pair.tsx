'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';
import { EMPTY_FIELD_VALUE } from '@myorg/modules/reconciliation/util';

export interface AmountPairProps {
  /** 法币金额。 */
  fiat?: number | null;
  /** Token 数量。 */
  token?: number | null;
  tokenSymbol?: string;
  className?: string;
}

/**
 * 法币 + token 双行渲染（迁移自旧 `renderAmountPair`）。
 * real-time/reserve 明细表格金额列共用。
 */
export function AmountPair({
  fiat,
  token,
  tokenSymbol,
  className,
}: AmountPairProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="tabular-nums">
        {fiat != null ? fiat.toLocaleString() : EMPTY_FIELD_VALUE}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {token != null
          ? `${token.toLocaleString()}${tokenSymbol ? ` ${tokenSymbol}` : ''}`.trim()
          : EMPTY_FIELD_VALUE}
      </span>
    </div>
  );
}
