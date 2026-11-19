'use client';

import * as React from 'react';
import { Copy } from 'lucide-react';
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
  /**
   * Truncation style. `end` (default) keeps the head and CSS-truncates the
   * tail; `middle` shortens long identifiers head-8 / tail-4 around an
   * ellipsis regardless of width (kissen gateway parity with the upstream
   * `CopyText` middleEllipsis(8, 4) convention for addresses / IDs).
   */
  truncate?: 'end' | 'middle';
  /** Text shown for empty values. Default `'--'`. */
  emptyText?: string;
  /** Label of the copy action inside the tooltip. Default `'Copy'`. */
  copyLabel?: string;
  /** Success toast text. Default `Copied: <value>`. */
  copySuccessMessage?: string;
  /** Failure toast text. Default `'Copy failed'`. */
  copyErrorMessage?: string;
  /**
   * Render a persistent inline copy icon next to the text. The tooltip then
   * omits its redundant copy link. Default `false`.
   */
  showCopyIcon?: boolean;
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
  truncate = 'end',
  emptyText = DEFAULT_EMPTY_DISPLAY,
  copyLabel = DEFAULT_COPY_LABEL,
  copySuccessMessage,
  copyErrorMessage,
  showCopyIcon = false,
  className,
  ...rest
}: CopyableEllipsisTextProps) {
  const toast = useToast();

  const isEmpty = value === null || value === undefined || String(value).trim() === '';
  const raw = isEmpty ? emptyText : String(value);
  // middleEllipsis(8, 4): values of 13 chars or fewer render in full.
  const displayText =
    truncate === 'middle' && raw.length > 12
      ? `${raw.slice(0, 8)}…${raw.slice(-4)}`
      : raw;


  const handleCopy = React.useCallback(async () => {
    if (value === null || value === undefined) return;
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(copySuccessMessage ?? `Copied: ${String(value)}`);
    } catch {
      toast.error(copyErrorMessage ?? 'Copy failed');
    }
  }, [value, toast, copySuccessMessage, copyErrorMessage]);

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
              <span className="break-all">{raw}</span>
              {copyable && !showCopyIcon ? (
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
      {copyable && showCopyIcon ? (
        <button
          type="button"
          data-copy-icon
          aria-label={`${copyLabel}: ${raw}`}
          title={copyLabel}
          onClick={handleCopy}
          className="ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Copy aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
