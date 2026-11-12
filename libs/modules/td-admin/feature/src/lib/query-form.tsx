'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

export interface QueryFormProps {
  /**
   * Filters shown on the single visible row. Keep this to at most three
   * entries so the row — including the action buttons — never wraps on
   * desktop widths.
   */
  fields: React.ReactNode[];
  /**
   * Additional filters revealed by the "More" toggle. Omit (or pass an empty
   * array) to render the form without the toggle.
   */
  advancedFields?: React.ReactNode[];
  /** Query handler; required when `queryType` is `button` (the default). */
  onQuery?: () => void;
  /** Reset handler. */
  onReset: () => void;
  queryLabel: string;
  resetLabel: string;
  /**
   * `submit` renders the query button as a form submit button for pages that
   * own a `<form onSubmit={handleSubmit(...)}>` wrapper around this panel.
   */
  queryType?: 'button' | 'submit';
  /** Extra controls rendered with the actions (e.g. an export button). */
  extra?: React.ReactNode;
  /** Start with the advanced filters visible. */
  defaultExpanded?: boolean;
  /**
   * `card` (default) renders the standalone panel; `plain` drops the card
   * surface for forms embedded in a `DetailSection`/drawer that already
   * provides its own container.
   */
  variant?: 'card' | 'plain';
  className?: string;
}

/**
 * Standard admin list filter panel: one compact row of filters with the
 * reset/query actions at the end and an optional "More" toggle for the rest.
 *
 * Presentation-only — callers own filter state, requests, and submission.
 * The deprecated `Card` + `h3 "Query"` header pattern is intentionally gone:
 * the filter row itself is the visual affordance.
 */
export function QueryForm({
  fields,
  advancedFields,
  onQuery,
  onReset,
  queryLabel,
  resetLabel,
  queryType = 'button',
  extra,
  defaultExpanded = false,
  variant = 'card',
  className,
}: QueryFormProps) {
  const t = useTranslations('common');
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const hasAdvanced = Boolean(advancedFields && advancedFields.length > 0);

  const content = (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map((field, index) => (
            <div key={index} className="flex min-w-0 flex-col justify-end">
              {field}
            </div>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {hasAdvanced ? (
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost">
                {expanded ? t('collapse') : t('more')}
                {expanded ? <ChevronUp /> : <ChevronDown />}
              </Button>
            </CollapsibleTrigger>
          ) : null}
          {extra}
          <Button type="button" variant="outline" onClick={onReset}>
            {resetLabel}
          </Button>
          <Button
            type={queryType === 'submit' ? 'submit' : 'button'}
            onClick={queryType === 'button' ? onQuery : undefined}
          >
            {queryLabel}
          </Button>
        </div>
      </div>
      {hasAdvanced ? (
        <CollapsibleContent>
          <div className="grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-2 xl:grid-cols-3">
            {(advancedFields ?? []).map((field, index) => (
              <div key={index} className="flex min-w-0 flex-col justify-end">
                {field}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );

  if (variant === 'plain') {
    return <div className={cn('space-y-3', className)}>{content}</div>;
  }

  return <Card className={cn('gap-3 p-4', className)}>{content}</Card>;
}
