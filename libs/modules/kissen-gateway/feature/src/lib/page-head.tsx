'use client';

/**
 * Gateway menu page header: title plus an optional action area.
 *
 * Variants preserve the layouts used by the migrated menu pages:
 * - compact: stacked title for role and log pages.
 * - toolbar: title with aligned actions for user pages.
 * - banner: title with trailing actions for menu and overview pages.
 * - stacked: title-only layout for onboarding pages.
 *
 * Category labels above menu titles are intentionally omitted.
 */
import type * as React from 'react';

export type PageHeadVariant = 'compact' | 'toolbar' | 'banner' | 'stacked';

/** Variant-specific title and action layout classes. */
const PAGE_HEAD_STYLES: Record<
  PageHeadVariant,
  { wrap: string; title: string; actions: string }
> = {
  compact: {
    wrap: '',
    title: 'text-xl font-semibold',
    actions: 'flex gap-2',
  },
  toolbar: {
    wrap: 'flex flex-wrap items-start justify-between gap-4',
    title: 'text-xl font-semibold tracking-tight',
    actions: 'flex gap-2',
  },
  banner: {
    wrap: 'flex flex-wrap items-end justify-between gap-3',
    title: 'text-2xl font-bold tracking-tight',
    actions: 'flex items-center gap-2',
  },
  stacked: {
    wrap: '',
    title: 'text-2xl font-bold tracking-tight',
    actions: 'flex gap-2',
  },
};

export function PageHead({
  title,
  variant = 'compact',
  children,
}: {
  title: string;
  variant?: PageHeadVariant;
  /** 右侧动作区内容，仅 toolbar/banner 渲染；compact/stacked 无动作区。 */
  children?: React.ReactNode;
}) {
  const styles = PAGE_HEAD_STYLES[variant];
  const hasActionsSlot = variant === 'toolbar' || variant === 'banner';
  const head = <h1 className={styles.title}>{title}</h1>;

  return (
    <div className={styles.wrap || undefined}>
      {hasActionsSlot ? <div>{head}</div> : head}
      {hasActionsSlot && children ? (
        <div className={styles.actions}>{children}</div>
      ) : null}
    </div>
  );
}
