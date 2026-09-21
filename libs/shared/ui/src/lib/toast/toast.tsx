'use client';

import * as React from 'react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

// Re-export the raw sonner `toast` so callers can use `toast.success()` etc.
// without needing the useToast() hook (e.g. in non-component contexts).
export { sonnerToast as toast };
import { cn } from '@myorg/shared/util-classnames';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Toast 时长约定（纲领 §8）：
 * - success / info / warning —— 3s 自动关闭（3000ms）
 * - error —— 5s 自动关闭（5000ms），留出阅读时间
 * - loading —— 不自动关闭，由调用方 toast.dismiss / 更新收尾
 * 显式传入 `duration` 时以调用方为准。
 */
const DURATION_DEFAULT_MS = 3000;
const DURATION_ERROR_MS = 5000;

/**
 * Toast notification hook wrapper around `sonner`.
 *
 * Provides a typed, project-specific API so the rest of the
 * codebase does not depend directly on sonner's surface.
 *
 * 文案主副行结构：`message` 为主行（font-medium，foreground），
 * `options.description` 为副行（13px，muted）。主行写结论，
 * 副行写原因/建议，不要把长句塞进主行。
 *
 * @example
 * const toast = useToast();
 * toast.success('Saved!');
 * toast.error('Oops', { description: 'Try again later.' });
 */
export function useToast() {
  const success = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.success(message, {
        description: options?.description,
        duration: options?.duration ?? DURATION_DEFAULT_MS,
        action: options?.action,
      }),
    []
  );

  const error = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.error(message, {
        description: options?.description,
        duration: options?.duration ?? DURATION_ERROR_MS,
        action: options?.action,
      }),
    []
  );

  const info = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.info(message, {
        description: options?.description,
        duration: options?.duration ?? DURATION_DEFAULT_MS,
        action: options?.action,
      }),
    []
  );

  const warning = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.warning(message, {
        description: options?.description,
        duration: options?.duration ?? DURATION_DEFAULT_MS,
        action: options?.action,
      }),
    []
  );

  const loading = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.loading(message, {
        description: options?.description,
        duration: options?.duration,
        action: options?.action,
      }),
    []
  );

  const dismiss = React.useCallback((toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  }, []);

  return { success, error, info, warning, loading, dismiss };
}

/**
 * Toaster outlet component.
 *
 * Mount once at the app root (e.g. inside the layout).
 * Positions toasts at the bottom-right by default.
 *
 * 语义色层级：icon + 左边框用语义 token（success/error/info/warning），
 * 文字保持 foreground/muted 以保证对比度；主副行结构见 useToast。
 */
export function Toaster({ className, ...props }: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="bottom-right"
      icons={{
        success: <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />,
        error: <XCircle className="h-5 w-5 shrink-0 text-destructive" />,
        warning: <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />,
        info: <Info className="h-5 w-5 shrink-0 text-info" />,
      }}
      toastOptions={{
        classNames: {
          toast: cn(
            'group toast flex w-full items-center gap-3 rounded-lg border bg-background py-3 pl-4 pr-5 text-foreground shadow-float',
            className
          ),
          title: 'text-sm font-medium leading-snug text-foreground',
          description: 'text-[13px] leading-snug text-muted-foreground',
          actionButton:
            'inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors',
          cancelButton:
            'inline-flex items-center justify-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 motion-safe:transition-colors',
          success: 'border-success/40',
          error: 'border-destructive/40',
          info: 'border-info/40',
          warning: 'border-warning/40',
        },
      }}
      {...props}
    />
  );
}
