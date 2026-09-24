'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import {
  Badge,
  type BadgeProps,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

/**
 * 原型口径 UI 公共件（源 kissen_prototype KNMS `components/ui/copyable-id.jsx`、
 * `components/ui/action-confirm-dialog.jsx`、PageKit `StatusBadge` / `Dash`；方案 12 §3：
 * 三 app 各自 feature 层统一一份等价实现，不引原型的 PageKit/Radix 代码、不进 shared）。
 *
 *  - Dash：空值 '-'（U+002D）灰色，禁止 '—' / 'N/A' / 留白
 *  - CopyableId：标识符中段截断（head…tail）+ 点击复制 + ✓ 反馈 2s
 *  - ActionConfirmDialog：40px 语义图标圆 + 标题 + 双段正文 + Cancel/Confirm
 *  - ProtoStatusBadge：带前置色点的状态徽章（语义色由调用方给；分类/类型标签仍用 Badge）
 */

/** CopyableId 复制成功后的 ✓ 反馈停留时长（原型 CopyableId 同款 2s）。 */
const COPY_FEEDBACK_MS = 2000;

/**
 * 剪贴板写入：优先 async Clipboard API；LAN http 下 `navigator.clipboard` 为 undefined，
 * 降级 `execCommand('copy')`（原型 copyable-id.jsx 同款降级策略）。
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到 execCommand 降级分支
  }
  try {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    const ok = document.execCommand('copy');
    helper.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 空值展示：'-' + 灰（方案 §3 空值口径）。单元格/详情字段空值统一走它。 */
export function Dash({ className }: { className?: string }) {
  return <span className={cn('text-muted-foreground', className)}>-</span>;
}

export interface CopyableIdProps {
  /** 完整标识符（交易号 / 钱包地址 / 池地址 / 哈希 / Trace ID…）；空值渲染 Dash。 */
  value?: string | number | null;
  /** 中段截断窗口：头/尾保留字符数，默认 8/8（`head8…tail8`）。 */
  head?: number;
  tail?: number;
  className?: string;
}

/**
 * 可复制标识符：中段截断 `head…tail`（禁止尾部省略号——标识符一律中间截断，
 * 列表与详情同口径）+ 复制按钮，点击复制后图标变绿 ✓ 停留 2s。
 *
 * 字体口径：组件内不设等宽（原型 AGENTS §3.2.4：标识符不加 `font-mono`）。
 */
export function CopyableId({
  value,
  head = 8,
  tail = 8,
  className,
}: CopyableIdProps) {
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(
    () => () => {
      clearTimeout(resetTimer.current);
    },
    [],
  );

  if (value === null || value === undefined || value === '') {
    return <Dash className={className} />;
  }

  const text = String(value);
  const display =
    text.length <= head + tail ? text : `${text.slice(0, head)}…${text.slice(-tail)}`;

  const handleCopy = async () => {
    if (!(await writeClipboard(text))) return;
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1', className)}>
      <span className="min-w-0 break-all">{display}</span>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy'}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {copied ? (
                <Check className="size-3.5 text-success" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="block max-w-[280px] break-all">{text}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

type ActionConfirmVariant = 'confirm' | 'destructive';

/** 40px 语义图标圆配色（原型 ICON_TONES 的 confirm/destructive 两档收窄口径）。 */
const ACTION_ICON_TONE: Record<ActionConfirmVariant, { circle: string; icon: string }> = {
  confirm: { circle: 'bg-success/10', icon: 'text-success' },
  destructive: { circle: 'bg-destructive/10', icon: 'text-destructive' },
};

export interface ActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 语义图标（lucide 组件，如 CircleCheck / CirclePause / Ban / KeyRound）。 */
  icon?: React.ComponentType<{ className?: string }>;
  /** 语义与配色：confirm = success 圆 + 主按钮；destructive = 危险圆 + 危险按钮。 */
  variant?: ActionConfirmVariant;
  title: string;
  /** 双段正文一：疑问句主句（加粗）——「确定要 … 吗？」 */
  body1: React.ReactNode;
  /** 双段正文二：后果句（浅灰独立段）——「Once … 不可撤销影响」。 */
  body2?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 提交中：双按钮禁用、确认按钮转 loading。 */
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * 确认类弹窗唯一实现（方案 §3：原型 AGENTS §3.6.1「确认弹窗双段正文 + 语义图标」的
 * 本项目等价件；短确认/单字段动作一律走它，多字段表单弹窗仍自组）。
 * 点遮罩不关闭（onInteractOutside 拦截，同既有 ResolveDialog 先例）。
 */
export function ActionConfirmDialog({
  open,
  onOpenChange,
  icon: Icon,
  variant = 'destructive',
  title,
  body1,
  body2,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
}: ActionConfirmDialogProps) {
  const tone = ACTION_ICON_TONE[variant];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        // 原型 ActionConfirmDialog：点遮罩不关
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                tone.circle,
              )}
              aria-hidden="true"
            >
              <Icon className={cn('size-[18px]', tone.icon)} />
            </span>
          )}
          <DialogTitle className="min-w-0">{title}</DialogTitle>
        </div>
        <DialogDescription asChild>
          <div>
            {body1 && (
              <p className="text-sm font-semibold leading-6 text-foreground">
                {body1}
              </p>
            )}
            {body2 && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {body2}
              </p>
            )}
          </div>
        </DialogDescription>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
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

/** 原型语义色（StatusBadge tone 口径）→ 本项目 Badge variant。 */
const PROTO_TONE_VARIANT: Record<ProtoStatusTone, NonNullable<BadgeProps['variant']>> = {
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  info: 'info',
  muted: 'mute',
};

/** 原型语义色集合（调用方按业务语义给色，枚举文案映射见 ./proto-enums）。 */
export type ProtoStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export interface ProtoStatusBadgeProps {
  /** 语义色由调用方给（如 success=成功/健康、warning=待处理、danger=失败/异常、info=处理中、muted=中性弱化）。 */
  tone: ProtoStatusTone;
  children: React.ReactNode;
  className?: string;
}

/**
 * 带前置色点的状态徽章（原型 AGENTS §3.14.1：状态/结果类展示一律带点）。
 * 分类/类型标签（Type / Built-in / 单位 / 计数）不加点，仍直接用 `Badge`。
 */
export function ProtoStatusBadge({ tone, children, className }: ProtoStatusBadgeProps) {
  return (
    <Badge variant={PROTO_TONE_VARIANT[tone]} dot className={className}>
      {children}
    </Badge>
  );
}
