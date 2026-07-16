'use client';

import * as React from 'react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';
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
 * Toast notification hook wrapper around `sonner`.
 *
 * Provides a typed, project-specific API so the rest of the
 * codebase does not depend directly on sonner's surface.
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
        duration: options?.duration,
        action: options?.action,
      }),
    []
  );

  const error = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.error(message, {
        description: options?.description,
        duration: options?.duration,
        action: options?.action,
      }),
    []
  );

  const info = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.info(message, {
        description: options?.description,
        duration: options?.duration,
        action: options?.action,
      }),
    []
  );

  const warning = React.useCallback(
    (message: string, options?: ToastOptions) =>
      sonnerToast.warning(message, {
        description: options?.description,
        duration: options?.duration,
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
 */
export function Toaster({ className, ...props }: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: cn(
            'group toast flex w-full items-center gap-3 rounded-lg border bg-background p-4 text-foreground shadow-lg',
            className
          ),
          description: 'text-sm text-muted-foreground',
          actionButton: 'inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          cancelButton: 'inline-flex items-center justify-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80',
          success: 'border-green-500/20 text-green-700 dark:text-green-300',
          error: 'border-red-500/20 text-red-700 dark:text-red-300',
          info: 'border-blue-500/20 text-blue-700 dark:text-blue-300',
          warning: 'border-yellow-500/20 text-yellow-700 dark:text-yellow-300',
        },
      }}
      {...props}
    />
  );
}
