'use client';

import * as React from 'react';
import { Check, Loader2, X } from 'lucide-react';

import { cn } from '@myorg/shared/util-classnames';

export type StepperStepStatus = 'complete' | 'current' | 'upcoming';
export type StepperStepTone = 'default' | 'warning' | 'danger' | 'info';

export interface StepperStep {
  /** Stable key for the step, independent of its visible label. */
  id: string;
  label: React.ReactNode;
  status: StepperStepStatus;
  tone?: StepperStepTone;
  /** Current step that is a successful terminal state, e.g. Completed. */
  terminal?: boolean;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  ariaLabel?: string;
  className?: string;
}

function isCompleted(step: StepperStep): boolean {
  return step.status === 'complete' || step.terminal === true;
}

function isFailed(step: StepperStep): boolean {
  return step.status === 'current' && step.tone === 'danger';
}

function nodeClass(step: StepperStep): string {
  if (isFailed(step)) {
    return 'border-red-600 bg-red-600 text-white shadow-[0_0_0_3px_rgba(220,38,38,0.2)]';
  }
  if (isCompleted(step)) {
    return step.tone === 'warning'
      ? 'border-amber-600 bg-amber-600 text-white'
      : 'border-teal-600 bg-teal-600 text-white';
  }
  if (step.status === 'current' && step.tone === 'info') {
    return 'border-slate-500 bg-slate-500 text-white shadow-[0_0_0_3px_rgba(100,116,139,0.2)]';
  }
  if (step.status === 'current') {
    return step.tone === 'warning'
      ? 'border-amber-600 bg-card text-amber-600 shadow-[0_0_0_3px_rgba(183,121,31,0.25)]'
      : 'border-teal-600 bg-card text-teal-600 shadow-[0_0_0_3px_rgba(11,107,83,0.2)]';
  }
  return 'border-border bg-card text-muted-foreground';
}

function labelClass(step: StepperStep): string {
  if (isFailed(step)) return 'font-medium text-red-600';
  if (step.tone === 'info') return 'font-medium text-slate-500';
  if (isCompleted(step)) return 'font-medium text-teal-600';
  if (step.status === 'current') {
    return step.tone === 'warning'
      ? 'font-medium text-amber-600'
      : 'font-medium text-teal-600';
  }
  if (step.status === 'complete') return 'text-gray-600';
  return 'text-muted-foreground';
}

function linkClass(next: StepperStep): string {
  if (isFailed(next)) return 'bg-red-600';
  if (next.tone === 'info') return 'bg-slate-500';
  return next.status !== 'upcoming' || next.terminal ? 'bg-teal-600' : 'bg-stone-300';
}

function StepNode({ step, index }: { step: StepperStep; index: number }) {
  const failed = isFailed(step);
  const completed = isCompleted(step);

  return (
    <span
      className={cn(
        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors',
        nodeClass(step),
      )}
      aria-hidden="true"
    >
      {step.status === 'current' && !completed && (
        <span className="absolute inset-0 rounded-full bg-current/15 motion-safe:animate-ping" />
      )}
      {failed ? (
        <X data-step-icon="error" className="relative size-4" strokeWidth={3} />
      ) : completed ? (
        <Check data-step-icon="check" className="size-4" strokeWidth={3} />
      ) : step.status === 'current' ? (
        <Loader2 data-step-icon="loading" className="relative size-4 motion-safe:animate-spin" />
      ) : (
        <span>{index + 1}</span>
      )}
    </span>
  );
}

/**
 * Responsive ordered Stepper for named lifecycle states.
 * It is intentionally not a progressbar: each item has its own business state.
 */
export function Stepper({ steps, ariaLabel = 'Progress', className }: StepperProps) {
  const renderSteps = (mobile: boolean) => (
    <ol
      className={cn(
        'w-full items-start',
        mobile ? 'flex flex-col md:hidden' : 'hidden md:flex',
      )}
      aria-label={ariaLabel}
    >
      {steps.map((step, index) => {
        const next = steps[index + 1];
        return (
          <li
            key={step.id}
            className={cn(
              mobile
                ? 'relative flex gap-3 pb-5 last:pb-0'
                : 'relative flex min-w-[100px] flex-1 flex-col items-center text-center',
            )}
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            {next ? (
              mobile ? (
                <span className="absolute left-[15px] top-8 h-full w-0.5 bg-border">
                  <span className={cn('block h-full rounded-sm', linkClass(next))} />
                </span>
              ) : (
                <span className="absolute left-1/2 top-4 h-0.5 w-full bg-border">
                  <span className={cn('block h-full w-full rounded-sm', linkClass(next))} />
                </span>
              )
            ) : null}
            <StepNode step={step} index={index} />
            <span
              className={cn(
                mobile
                  ? 'pt-1 text-xs leading-4'
                  : 'mt-2 max-w-[140px] text-xs leading-4 text-balance',
                labelClass(step),
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return <div className={cn('w-full', className)}>{renderSteps(false)}{renderSteps(true)}</div>;
}
