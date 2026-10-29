/**
 * OverviewShell 的 loading / error 兜底渲染（骨架块与重试按钮）。
 * 源: overview-shell.tsx 525-554
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

/** loading 态骨架块（applyList 拉取中，避免空数据误判为 Empty；不写死文案）。 */
export function OverviewShellLoading(): React.JSX.Element {
  return (
    <div className="w-full space-y-4">
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-12 w-2/3 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

interface OverviewShellErrorProps {
  /** 重新拉取 applyList（react-query refetch）。 */
  refetchApplyList: () => Promise<unknown>;
}

/** 错误态：拉取失败且无数据（react-query 有旧数据时保留旧数据继续展示）。 */
export function OverviewShellError({
  refetchApplyList,
}: OverviewShellErrorProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">
        {t('td_query_load_failed')}
      </p>
      <button
        type="button"
        className="rounded-md border px-4 py-1.5 text-sm hover:bg-accent"
        onClick={() => void refetchApplyList()}
      >
        {t('td_retry')}
      </button>
    </div>
  );
}
