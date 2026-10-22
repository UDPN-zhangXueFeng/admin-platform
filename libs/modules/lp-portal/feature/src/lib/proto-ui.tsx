'use client';

/**
 * 原型口径公共 UI 件（方案 12 §3 P0）：Dash / CopyableId / ActionConfirmDialog /
 * ProtoStatusBadge。形态与交互对齐 LPP 原型共享件（demo AGENTS §3.2.3 标识符
 * 中段截断、§3.6.1 双段正文确认弹窗、§3.14.1 状态一律带点、空值 '-'），
 * 落地在本仓 UI 体系（@myorg/shared/ui 的 Badge / Button / Dialog）上。
 */

import * as React from 'react';
import { Check as CheckIcon, Copy as CopyIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  type BadgeProps,
} from '@myorg/shared/ui';

/** 语义色集合（原型 StatusBadge tone 同集）：success/warning/danger/info/primary/muted。 */
export type ProtoTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'muted';

/* ================================================================== */
/* Dash                                                                */

/** 空值占位：null/undefined/'' → 灰色 '-'；非空透传 children（缺省渲染 value 文本）。 */
export function Dash({
  value,
  children,
  className,
}: {
  /** 待判定值：null/undefined/'' 视为空 */
  value?: string | number | null;
  /** 非空时渲染的内容；缺省渲染 value 本身 */
  children?: React.ReactNode;
  className?: string;
}) {
  if (value === null || value === undefined || value === '') {
    return <span className={cn('text-muted-foreground', className)}>-</span>;
  }
  return <span className={className}>{children ?? String(value)}</span>;
}

/* ================================================================== */
/* CopyableId                                                          */

/** 复制成功反馈保持时长（demo AGENTS §3.2.3：点后绿色 ✓）。 */
const COPY_FEEDBACK_MS = 2000;

/** 中段截断：长度 ≤ head+tail 整串展示，否则 `head…tail`（标识符一律中间截断，禁尾部省略号）。 */
function truncateMiddle(value: string, head: number, tail: number): string {
  return value.length <= head + tail
    ? value
    : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** 复制全文：优先异步 Clipboard API；非 HTTPS（局域网 IP）下降级 execCommand（原型同款兜底）。 */
async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 落到 execCommand 降级
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 长标识符（交易号 / 钱包地址 / 哈希 / Trace ID）展示 + 复制：
 * 显示中段截断（默认 head 8 … tail 8），复制的是完整 value；成功后按钮变绿 ✓
 * 保持 2s。空值 → '-'。
 */
export function CopyableId({
  value,
  headChars = 8,
  tailChars = 8,
  maxWidth,
  className,
}: {
  /** 完整标识符（复制即复制它）；null/undefined/'' → '-' */
  value?: string | null;
  /** 中段截断保留的头部长度（默认 8） */
  headChars?: number;
  /** 中段截断保留的尾部长度（默认 8） */
  tailChars?: number;
  /** 显示宽度上限 px（缺省不限，靠容器 min-w-0 收缩） */
  maxWidth?: number;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  if (value === null || value === undefined || value === '') {
    return <span className={cn('text-muted-foreground', className)}>-</span>;
  }

  const id = value;

  async function handleCopy() {
    if (await copyText(id)) {
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(
        () => setCopied(false),
        COPY_FEEDBACK_MS,
      );
    }
  }

  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center gap-1', className)}
      style={maxWidth === undefined ? undefined : { maxWidth }}
    >
      <span className="min-w-0 truncate tabular-nums" title={value}>
        {truncateMiddle(value, headChars, tailChars)}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy'}
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-sm outline-none',
          copied ? 'text-success' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {copied ? (
          <CheckIcon className="size-3.5" aria-hidden="true" />
        ) : (
          <CopyIcon className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

/* ================================================================== */
/* ActionConfirmDialog                                                 */

/** 语义色 → 40px 图标圆底色/图色（软底 10% + 语义前景，Badge soft 档同口径）。 */
const ICON_TONES: Record<ProtoTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
};

export interface ActionConfirmDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 开合回调（点遮罩不关；仅右上角 X / ESC / Cancel 触发关闭） */
  onOpenChange: (open: boolean) => void;
  /** 语义图标（lucide 组件；如 Activate → CircleCheck、Deactivate → CirclePause） */
  icon?: LucideIcon;
  /** 图标语义色（默认 warning） */
  iconTone?: ProtoTone;
  /** 标题 */
  title: string;
  /** 正文第一段：疑问句主句（加粗，如 Deactivate this user?） */
  body1: string;
  /** 正文第二段：后果句（浅灰独立段，如 Once deactivated, …）；可缺省 */
  body2?: string;
  /** 确认按钮文案（如 Deactivate / Confirm） */
  confirmLabel: string;
  /** 取消按钮文案（默认 Cancel） */
  cancelLabel?: string;
  /** 确认按钮配色：confirm = 主色（Activate 类）；destructive = 破坏性红（Deactivate/Delete 类） */
  confirmTone?: 'confirm' | 'destructive';
  /** 确认请求进行中（确认按钮转 loading、双按钮禁用） */
  loading?: boolean;
  /** 点确认回调（弹窗不自动关，由调用方成功后收口） */
  onConfirm: () => void;
}

/**
 * TDSC 式轻量动作确认弹窗（原型 ui/action-confirm-dialog 同形态）：
 * 左侧 40px 语义图标圆 + 标题 + 双段正文（body1 加粗疑问句 / body2 浅灰后果句）
 * + [Cancel(secondary, 左)] [Confirm(语义色, 右)]；点遮罩不关。
 * 文案生成（按目标对象拼接）留在页面各自的 *_ACTION_CONFIG 表里。
 */
export function ActionConfirmDialog({
  open,
  onOpenChange,
  icon: Icon,
  iconTone = 'warning',
  title,
  body1,
  body2,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmTone = 'confirm',
  loading = false,
  onConfirm,
}: ActionConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full',
                ICON_TONES[iconTone],
              )}
              aria-hidden="true"
            >
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0 pt-0.5">
            <DialogTitle className="text-left">{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="mt-2">
                <p className="text-sm font-semibold leading-6 text-foreground">
                  {body1}
                </p>
                {body2 ? (
                  <p className="mt-3 text-sm leading-5 text-muted-foreground">
                    {body2}
                  </p>
                ) : null}
              </div>
            </DialogDescription>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmTone === 'destructive' ? 'destructive' : 'default'}
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

/* ================================================================== */
/* ProtoStatusBadge                                                    */

/** 语义色 → Badge 变体（danger→destructive、primary→default、muted→mute）。 */
const TONE_TO_BADGE_VARIANT: Record<ProtoTone, NonNullable<BadgeProps['variant']>> = {
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  info: 'info',
  primary: 'default',
  muted: 'mute',
};

/**
 * 带色点状态徽章（demo AGENTS §3.14.1：状态/结果类展示一律带前置 1.5px 圆点，
 * 颜色随语义色；语义色由调用方给，本组件不做码→色推断）。分类/类型标签不加点，
 * 仍用普通 Badge。
 */
export function ProtoStatusBadge({
  label,
  tone = 'muted',
  className,
}: {
  /** 徽章文案（建议来自 proto-enums 各映射表的 label） */
  label: string;
  /** 语义色（默认 muted） */
  tone?: ProtoTone;
  className?: string;
}) {
  return (
    <Badge
      variant={TONE_TO_BADGE_VARIANT[tone]}
      dot
      className={className}
    >
      {label}
    </Badge>
  );
}
