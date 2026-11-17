'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';
import { Button } from '../button';

export interface PageBackButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export function PageBackButton({ label, onClick, className }: PageBackButtonProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="iconSm"
      className={cn('-ml-2 mt-0.5 shrink-0 text-muted-foreground hover:text-foreground', className)}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <ArrowLeft aria-hidden="true" />
    </Button>
  );
}

export interface PageHeaderProps {
  backLabel: string;
  onBack: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  backLabel,
  onBack,
  title,
  eyebrow,
  description,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-1">
        <PageBackButton label={backLabel} onClick={onBack} />
        <div className="min-w-0">
          {eyebrow != null && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          )}
          <h1 className="mt-1 truncate text-xl font-semibold">{title}</h1>
          {description != null && (
            <p className="mt-1 break-all text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions != null && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
