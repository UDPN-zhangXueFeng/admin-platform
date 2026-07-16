'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Badge,
  CardDescription,
  CardTitle,
} from '@myorg/shared/ui';

/**
 * SectionHeading —— 重设计风的 section 卡片标题带（迁移自 tokenized-deposit-redesign）。
 *
 * 图标 tile（rounded-lg bg-primary/10 text-primary）+ 标题 + 可选徽标 + 描述，
 * 落在 `border-b bg-muted/35` 的卡片头分隔带上。纯视觉，配合 `<Card>` 使用：
 *
 * ```tsx
 * <Card>
 *   <SectionHeading icon={FileKey} title="Token details" description="..." />
 *   <CardContent>...fields...</CardContent>
 * </Card>
 * ```
 */
export interface SectionHeadingProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
}

export function SectionHeading({
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant = 'secondary',
}: SectionHeadingProps): React.JSX.Element {
  return (
    <div className="border-b bg-muted/35 px-6 py-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
          </div>
          {description ? (
            <CardDescription className="leading-relaxed">
              {description}
            </CardDescription>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 必填星号（text-destructive，aria-hidden 由 label 文本承载语义）。 */
export function Required(): React.JSX.Element {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}
