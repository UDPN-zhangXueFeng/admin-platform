'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';
import { Label } from '../label';

/**
 * Field 字段系统（shadcn 风，Tailwind v3）。
 *
 * 迁移自 tokenized-deposit-redesign 的 field.tsx（v4），简化为 v3 兼容：
 * 去掉 `@container`/`nth-last-2`/`data-slot` 选择器等 v4 特性，保留
 * FieldSet/FieldLegend/FieldGroup/Field/FieldLabel/FieldDescription/FieldError。
 */
function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset
      className={cn('flex flex-col gap-4', className)}
      {...props}
    />
  );
}

function FieldLegend({ className, ...props }: React.ComponentProps<'legend'>) {
  return (
    <legend
      className={cn('mb-1.5 text-base font-medium', className)}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex w-full flex-col gap-5', className)}
      {...props}
    />
  );
}

const fieldVariants = cva('group/field flex w-full gap-2', {
  variants: {
    orientation: {
      vertical: 'flex-col *:w-full',
      horizontal: 'flex-row items-center gap-3',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});

function Field({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      className={cn(
        'flex w-fit items-center gap-1.5 text-sm font-medium leading-snug',
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm leading-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cn('text-sm text-destructive', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
};
