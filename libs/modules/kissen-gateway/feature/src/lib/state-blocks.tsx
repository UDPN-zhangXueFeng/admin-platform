'use client';

/**
 * 列表/详情通用状态块：loading / error / 空态 / 缺参兜底 / 详情外壳。
 *
 * 由 role/tx-user-系副本收敛，两套并存的样式各自成对保留
 * （渲染输出与收敛前逐字节一致）：
 * - LoadingBlock：text（role 的 py-10 文案，默认）｜skeleton
 *   （user/onboard 的三行骨架）。
 * - ErrorBlock（role：py-10、span、Button type="button"）与
 *   QueryErrorRetry（user/menu/onboard：py-8 居中、p 文案；menu/onboard
 *   带 withIcon 刷新图标）是两套独立约定，不做合并。
 */
import type * as React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button, Skeleton } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

/** 加载态：text = py-10 居中文案（role）；skeleton = 三行骨架（user/onboard）。 */
export function LoadingBlock({ variant = 'text' }: { variant?: 'text' | 'skeleton' }) {
  if (variant === 'skeleton') {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
}

/** 加载失败提示 + 重试（role 约定；error 状态必须可感知并可恢复）。 */
export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm">
      <span className="text-destructive">Failed to load: {message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** 查询失败 + 重试（user/menu/onboard 约定；withIcon 为 menu/onboard 的刷新图标）。 */
export function QueryErrorRetry({
  error,
  onRetry,
  withIcon = false,
}: {
  error: unknown;
  onRetry: () => void;
  withIcon?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-destructive">Failed to load: {(error as Error).message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {withIcon && <RefreshCw />}
        Retry
      </Button>
    </div>
  );
}

/** 空态提示（源 el-empty description 的 React 等价）。 */
export function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}

/** 路由缺参/非法提示 + 返回列表（edit/detail 无有效 id 时的可感知兜底）。 */
export function MissingIdBlock({
  message,
  backTo,
}: {
  message: string;
  backTo: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm">
      <span className="text-destructive">{message}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.push(backTo)}
      >
        Back to List
      </Button>
    </div>
  );
}

/** 详情页外壳：返回列表 + 标题 + 内容卡（role/tx 详情域）。 */
export function DetailShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        {children}
      </section>
    </div>
  );
}
