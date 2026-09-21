'use client';

/**
 * 页头（源 .page-head：eyebrow 小标 + 标题 + 可选右侧动作区）。
 *
 * 由 role/user/menu/onboard/log 各页面本地副本收敛；variant
 * 精确对应迁移期既存的四组类名组合（渲染输出与收敛前逐字节一致）：
 * - compact（默认）：role/log —— 纯堆叠、eyebrow 大写风格、xl 标题。
 * - toolbar：user —— 动作区 items-start 对齐、gap-4、动作容器 flex gap-2。
 * - banner：menu —— 动作区 items-end 对齐、gap-3、2xl bold 标题。
 * - stacked：onboard —— space-y-1 紧凑堆叠、2xl bold 标题、无动作区。
 *
 * log 原内联页头并入 compact：其 eyebrow 文本 'PORTAL' 本为大写，
 * compact 的 uppercase 类对它是渲染空操作，视觉逐字节不变。
 */
import type * as React from 'react';

export type PageHeadVariant = 'compact' | 'toolbar' | 'banner' | 'stacked';

/** 各 variant 的类名组合（保持与收敛前各页面副本逐字一致）。 */
const PAGE_HEAD_STYLES: Record<
  PageHeadVariant,
  { wrap: string; eyebrow: string; title: string; actions: string }
> = {
  compact: {
    wrap: '',
    eyebrow: 'text-xs font-semibold uppercase tracking-widest text-muted-foreground',
    title: 'mt-1 text-xl font-semibold',
    actions: 'flex gap-2',
  },
  toolbar: {
    wrap: 'flex flex-wrap items-start justify-between gap-4',
    eyebrow: 'text-xs font-semibold tracking-widest text-muted-foreground',
    title: 'mt-1 text-xl font-semibold tracking-tight',
    actions: 'flex gap-2',
  },
  banner: {
    wrap: 'flex flex-wrap items-end justify-between gap-3',
    eyebrow: 'text-xs font-semibold tracking-widest text-muted-foreground',
    title: 'mt-1 text-2xl font-bold tracking-tight',
    actions: 'flex items-center gap-2',
  },
  stacked: {
    wrap: 'space-y-1',
    eyebrow: 'text-xs font-semibold tracking-widest text-muted-foreground',
    title: 'text-2xl font-bold tracking-tight',
    actions: 'flex gap-2',
  },
};

export function PageHead({
  eyebrow = 'PORTAL',
  title,
  variant = 'compact',
  children,
}: {
  /** eyebrow 小标文本；绝大多数页面为 'PORTAL'（默认）。 */
  eyebrow?: string;
  title: string;
  variant?: PageHeadVariant;
  /** 右侧动作区内容，仅 toolbar/banner 渲染；compact/stacked 无动作区。 */
  children?: React.ReactNode;
}) {
  const styles = PAGE_HEAD_STYLES[variant];
  const hasActionsSlot = variant === 'toolbar' || variant === 'banner';
  const head = (
    <>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1 className={styles.title}>{title}</h1>
    </>
  );

  return (
    <div className={styles.wrap || undefined}>
      {hasActionsSlot ? <div>{head}</div> : head}
      {hasActionsSlot && children ? (
        <div className={styles.actions}>{children}</div>
      ) : null}
    </div>
  );
}
