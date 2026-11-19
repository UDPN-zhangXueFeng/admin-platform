'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';
import { Alert } from '../alert';
import { Button } from '../button';
import { cardSurfaceClass } from '../card';

/**
 * DetailSection —— 详情区块（标题 + 可选右侧操作 + 内容/骨架/错误三态）。
 *
 * 标题在 loading 期间照常渲染（避免卡片跳动）；loading 用与栅格对齐的骨架
 * （表格型区块可传 `skeleton="table"`）；error 用 destructive Alert + 重试。
 * 重试文案/无障碍名称由调用方翻译传入，ui 层不调用 t()。
 */
export type DetailSectionError = {
  message?: React.ReactNode;
  onRetry(): void;
} & (
  | {
      /** 可见的重试文案，同时作为按钮的无障碍名称（调用方本地化）。 */
      retryLabel: string;
      retryAriaLabel?: string;
    }
  | {
      retryLabel?: undefined;
      /** 仅图标重试按钮的无障碍名称（调用方本地化）。 */
      retryAriaLabel: string;
    }
);

export interface DetailSectionProps {
  title: string;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: DetailSectionError | null;
  /**
   * 正常内容的内边距：`default` 使用区块标准内边距（移动 16px / 桌面 24px），
   * `none` 让内容自行贴边（如表格）。骨架与错误始终保留标准内边距。
   */
  contentPadding?: 'default' | 'none';
  /** loading 时的骨架形态：字段栅格（默认）或表格行。 */
  skeleton?: 'fields' | 'table';
  children: React.ReactNode;
}

const FIELD_SKELETON_COUNT = 6;
const TABLE_SKELETON_ROWS = 5;
const CONTENT_PADDING = 'px-4 pb-4 sm:px-6 sm:pb-6';
const FIELD_SKELETON_GRID = 'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2';

function FieldsSkeleton() {
  return (
    <div aria-hidden="true" className={FIELD_SKELETON_GRID}>
      {Array.from({ length: FIELD_SKELETON_COUNT }, (_, index) => (
        <div key={index} className="min-w-0 animate-pulse">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="mt-2 h-4 w-2/3 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: TABLE_SKELETON_ROWS }, (_, index) => (
        <div
          key={index}
          className="h-10 w-full animate-pulse rounded bg-muted"
        />
      ))}
    </div>
  );
}

function ErrorAlert({ error }: { error: DetailSectionError }) {
  const accessibleName = error.retryAriaLabel ?? error.retryLabel;

  return (
    <Alert variant="destructive">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 break-words">{error.message}</span>
        <Button
          type="button"
          variant="outline"
          size={error.retryLabel ? 'sm' : 'iconSm'}
          onClick={error.onRetry}
          aria-label={accessibleName}
        >
          {error.retryLabel ?? <RefreshCw aria-hidden="true" />}
        </Button>
      </div>
    </Alert>
  );
}

export function DetailSection({
  title,
  actions,
  loading = false,
  error = null,
  contentPadding = 'default',
  skeleton = 'fields',
  children,
}: DetailSectionProps) {
  const useStandardPadding =
    Boolean(error) || loading || contentPadding === 'default';
  const headingId = React.useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex flex-col overflow-hidden', cardSurfaceClass)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
        <h2
          id={headingId}
          className="min-w-0 break-words text-base font-semibold leading-snug"
        >
          {title}
        </h2>
        {actions ? (
          <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      <div
        className={cn('min-w-0', useStandardPadding && CONTENT_PADDING)}
        aria-busy={(loading && !error) || undefined}
      >
        {error ? (
          <ErrorAlert error={error} />
        ) : loading ? (
          skeleton === 'table' ? (
            <TableSkeleton />
          ) : (
            <FieldsSkeleton />
          )
        ) : (
          children
        )}
      </div>
    </section>
  );
}
