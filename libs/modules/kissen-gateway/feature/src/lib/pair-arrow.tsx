import { ArrowRight } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';

/**
 * token 对 / bank 对之间的箭头（2026-11-11 统一）。
 *
 * 之前各页面用文本 `→`（不同字号/间距，视觉很重）；统一改成 lucide 图标箭头：
 * muted 灰、1rem、随文字基线对齐。文本流的相邻处直接内联使用，
 * flex 行里也可直接当子元素（align 属性在 flex 下无副作用）。
 */
export function PairArrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      className={cn(
        'inline-block size-3.5 shrink-0 align-[-0.125em] text-muted-foreground/70',
        className,
      )}
      aria-hidden="true"
    />
  );
}
