'use client';

/**
 * 原型口径公共展示件（plan/12 §3 落地表）。
 *
 * 四个横切件对齐 BP 原型 PageKit/ui 组件语义，全部基于 @myorg/shared/ui
 * 既有能力薄封装（Badge 已带 dot、Dialog 系、Tooltip 系、Button），不引入
 * 新依赖：
 * - Dash：空值统一 '-' + 灰色（AGENTS.md §3.17；kit.orDash 的 JSX 等价）。
 * - CopyableId：标识符中段截断 head…tail + 复制 + ✓ 反馈 2s + Tooltip 回显全值。
 * - ActionConfirmDialog：双段正文（疑问主句 + 后果句）确认弹窗，语义图标
 *   圆 + confirm/destructive 两种确认配色；点遮罩不关闭（原型同款）。
 * - ProtoStatusBadge：带色点徽章（AGENTS.md §3.14.1），语义色 tone 由调用方给。
 */
import * as React from 'react';

import { Check, Copy } from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type BadgeProps,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

/** 空值占位：'-'（U+002D）+ 灰色；所有原型口径空单元格用它。 */
export function Dash({ className }: { className?: string }) {
  return <span className={cn('text-muted-foreground', className)}>-</span>;
}

/* ─────────────────────── 状态徽章 ─────────────────────── */

/** 语义色集合（与 ActionConfirmDialog 图标色共用词汇；调用方按状态语义给）。 */
export type ProtoStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'muted';

/** tone → shared Badge variant（Badge 自带 dot 色点，颜色随 variant）。 */
const TONE_BADGE_VARIANT: Record<ProtoStatusTone, NonNullable<BadgeProps['variant']>> = {
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  info: 'info',
  primary: 'default',
  muted: 'mute',
};

export interface ProtoStatusBadgeProps {
  /** 徽章文案（直接传 protoStatusText 的输出或字面量）。 */
  label: React.ReactNode;
  /** 语义色；默认 muted（灰）。 */
  tone?: ProtoStatusTone;
  size?: BadgeProps['size'];
  className?: string;
}

/** 带色点状态徽章：所有列表/详情状态列统一用它，不再各页自配色。 */
export function ProtoStatusBadge({
  label,
  tone = 'muted',
  size,
  className,
}: ProtoStatusBadgeProps) {
  return (
    <Badge
      variant={TONE_BADGE_VARIANT[tone]}
      size={size}
      dot
      className={className}
    >
      {label}
    </Badge>
  );
}

/* ─────────────────────── 可复制标识符 ─────────────────────── */

/** 复制成功/失败反馈停留时长（合同口径 2s）。 */
const COPY_FEEDBACK_MS = 2000;

/** 中段截断：长度 ≤ head+tail 显全值，否则 `head…tail`。 */
export function truncateMiddle(value: string, head = 8, tail = 8): string {
  return value.length <= head + tail
    ? value
    : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** 复制到剪贴板：navigator.clipboard 优先，非安全上下文降级 execCommand
 * （原型 lib/clipboard.js 同口径），返回是否成功。 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export interface CopyableIdProps {
  /** 标识符（交易号/地址/哈希/instanceId）；空值渲染 Dash。 */
  value?: string | number | null;
  /** 中段截断窗口；默认 8…8（合同口径）。 */
  head?: number;
  tail?: number;
  className?: string;
}

/** 可复制标识符：中段截断展示 + Tooltip 回显全值（§3.13.4）+ 独立复制钮，
 * 成功 Copy→✓ 并变 success 色 2s，失败变 destructive 色。 */
export function CopyableId({
  value,
  head = 8,
  tail = 8,
  className,
}: CopyableIdProps) {
  const [feedback, setFeedback] = React.useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const resetTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => clearTimeout(resetTimer.current), []);

  if (value === null || value === undefined || value === '') {
    return <Dash className={className} />;
  }
  const text = String(value);
  const shown = truncateMiddle(text, head, tail);

  async function handleCopy() {
    const ok = await copyText(text);
    setFeedback(ok ? 'copied' : 'error');
    clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(
      () => setFeedback('idle'),
      COPY_FEEDBACK_MS,
    );
  }

  return (
    <span className={cn('inline-flex max-w-full items-center gap-1', className)}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 cursor-default whitespace-nowrap tabular-nums">
              {shown}
              {shown !== text && <span className="sr-only"> ({text})</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs break-all">{text}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy ${text}`}
              className={cn(
                'shrink-0 rounded-md p-1 transition-colors',
                feedback === 'copied'
                  ? 'text-success'
                  : feedback === 'error'
                    ? 'text-destructive'
                    : 'text-muted-foreground hover:text-primary',
              )}
            >
              {feedback === 'copied' ? (
                <Check className="size-3.5" strokeWidth={2.75} aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {feedback === 'copied'
              ? 'Copied'
              : feedback === 'error'
                ? 'Copy unavailable'
                : 'Copy'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

/* ─────────────────────── 双段正文确认弹窗 ─────────────────────── */

/** 语义图标圆配色（成功/警告/危险/告知/主色；与 ProtoStatusTone 共词汇）。 */
export type ActionConfirmTone = Exclude<ProtoStatusTone, 'muted'>;

const CONFIRM_TONE_CIRCLE: Record<ActionConfirmTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary/10 text-primary',
};

export interface ActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** lucide 语义图标组件（如 CircleCheck / CircleAlert / CircleHelp），缺省不渲染圆。 */
  icon?: React.ComponentType<{ className?: string }>;
  /** 图标圆语义色；默认 warning。 */
  tone?: ActionConfirmTone;
  title: React.ReactNode;
  /** 正文一段：疑问主句（主文本色、加粗），如 `Deactivate token USDT?`。 */
  body1: React.ReactNode;
  /** 正文二段：后果句（浅灰、独立段），如 `Once deactivated, ...`。 */
  body2?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** 确认钮配色：confirm=主操作色 / destructive=破坏性（默认 destructive，原型同默认）。 */
  variant?: 'confirm' | 'destructive';
  /** 确认中（loading 转圈并禁用两个按钮）。 */
  loading?: boolean;
  onConfirm?: () => void;
}

/** 操作确认弹窗（Activate/Deactivate/Disable 等危险与关键操作共用）。
 * 双段正文 + 40px 语义图标圆；点遮罩不关闭、ESC/× 可关（原型同款）。 */
export function ActionConfirmDialog({
  open,
  onOpenChange,
  icon: Icon,
  tone = 'warning',
  title,
  body1,
  body2,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
  onConfirm,
}: ActionConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(event: CustomEvent) => event.preventDefault()}
      >
        <div className="flex items-start gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid size-10 shrink-0 place-items-center rounded-full',
                CONFIRM_TONE_CIRCLE[tone],
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          )}
          <div className="min-w-0 pt-0.5">
            <DialogTitle className="text-left text-base font-bold leading-6">
              {title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="mt-2 text-left">
                {body1 !== undefined && body1 !== null && (
                  <p className="text-sm font-semibold leading-6 text-foreground">
                    {body1}
                  </p>
                )}
                {body2 !== undefined && body2 !== null && (
                  <p className="mt-3 text-sm leading-5 text-muted-foreground">
                    {body2}
                  </p>
                )}
              </div>
            </DialogDescription>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={loading}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={variant === 'confirm' ? 'default' : 'destructive'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
