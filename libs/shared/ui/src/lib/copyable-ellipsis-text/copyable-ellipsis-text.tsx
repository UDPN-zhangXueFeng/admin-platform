'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../tooltip';
import { useToast } from '../toast';

const DEFAULT_EMPTY_DISPLAY = '--';
const DEFAULT_COPY_LABEL = 'Copy';
const DEFAULT_MAX_WIDTH = 200;

export interface CopyableEllipsisTextProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Value to display. `null` / `undefined` / empty / whitespace renders the empty placeholder. */
  value?: string | number | null;
  /** Whether the field supports copy. Default `true`. */
  copyable?: boolean;
  /** Max width in px before the text truncates with an ellipsis. Default `200`. */
  maxWidth?: number;
  /** Text shown for empty values. Default `'--'`. */
  emptyText?: string;
  /** Label of the copy action inside the tooltip. Default `'Copy'`. */
  copyLabel?: string;
}

/**
 * CopyableEllipsisText — table-friendly text display.
 *
 * - Truncates with an ellipsis when the value exceeds `maxWidth`.
 * - Hover reveals a tooltip with the full value plus a copy action.
 * - `null` / `undefined` / empty / whitespace renders the empty placeholder
 *   (and is NOT copyable).
 *
 * Self-contained: mounts its own `TooltipProvider` so it works regardless of
 * whether the host app provides a global Radix tooltip provider. Copy uses the
 * async Clipboard API with a toast for success/error feedback.
 */
export function CopyableEllipsisText({
  value,
  copyable = true,
  maxWidth = DEFAULT_MAX_WIDTH,
  emptyText = DEFAULT_EMPTY_DISPLAY,
  copyLabel = DEFAULT_COPY_LABEL,
  className,
  ...rest
}: CopyableEllipsisTextProps) {
  const toast = useToast();

  const isEmpty = value === null || value === undefined || String(value).trim() === '';
  const displayText = isEmpty ? emptyText : String(value);

  const handleCopy = React.useCallback(async () => {
    if (value === null || value === undefined) return;
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`Copied: ${String(value)}`);
    } catch {
      toast.error('Copy failed');
    }
  }, [value, toast]);

  if (isEmpty) {
    return (
      <div
        style={{ maxWidth }}
        className={cn('inline-flex min-w-0 items-center', className)}
        {...rest}
      >
        <span className="inline-block min-w-0 truncate">{displayText}</span>
      </div>
    );
  }

  return (
    <div
      style={{ maxWidth }}
      className={cn('inline-flex min-w-0 items-center', className)}
      {...rest}
    >
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block min-w-0 cursor-default truncate">
              {displayText}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              <span className="break-all">{displayText}</span>
              {copyable ? (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ml-1 text-primary hover:underline"
                >
                  {copyLabel}
                </button>
              ) : null}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
