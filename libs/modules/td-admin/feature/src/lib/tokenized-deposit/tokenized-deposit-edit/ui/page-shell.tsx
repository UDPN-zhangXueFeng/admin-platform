'use client';

import * as React from 'react';
import { ArrowLeft, Check, ChevronRight, Info } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Separator,
} from '@myorg/shared/ui';

/**
 * 重设计页面 chrome（迁移自 tokenized-deposit-redesign，v3 + Radix 重写）。
 * OnboardHeader / SummaryAside / BottomActionBar 三个纯展示 helper，
 * 数据由 FormContent 计算后传入。
 */

export interface StepItem {
  title: string;
  sub: string;
}

export interface OnboardHeaderProps {
  onBack: () => void;
  backLabel: string;
  title: string;
  badge?: string;
  badgeVariant?:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'ghost'
    | 'link';
  description?: string;
  progressLabel?: string;
  progress?: number;
  steps?: StepItem[];
  activeStep?: number;
  maxReachedStep?: number;
  onStepChange?: (index: number) => void;
}

export function OnboardHeader({
  onBack,
  backLabel,
  title,
  badge,
  badgeVariant = 'outline',
  description,
  progressLabel,
  progress,
  steps,
  activeStep = 0,
  maxReachedStep = activeStep,
  onStepChange,
}: OnboardHeaderProps): React.JSX.Element {
  return (
    <header className="border-b bg-card">
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-fit text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Button>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="flex max-w-2xl flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
            </div>
            {description ? (
              <p className="text-base leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {progress !== undefined ? (
            <div className="flex min-w-56 flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{progressLabel}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          ) : null}
        </div>
        {steps && steps.length ? (
          <nav
            aria-label="Onboarding steps"
            className="grid gap-2 md:grid-cols-3"
          >
            {steps.map((step, index) => {
              const active = index === activeStep;
              const done = index < activeStep;
              const reachable = index <= maxReachedStep;
              return (
                <button
                  type="button"
                  key={step.title}
                  disabled={!reachable || !onStepChange}
                  onClick={() => onStepChange?.(index)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    active ? 'border-primary/30 bg-primary/5' : 'bg-muted/30'
                  } ${reachable ? 'text-left' : 'cursor-not-allowed text-left opacity-60'}`}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : done
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {done ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{step.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {step.sub}
                    </span>
                  </span>
                  {active ? (
                    <ChevronRight
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>
    </header>
  );
}

export interface SummaryRow {
  label: string;
  complete: boolean;
}

export interface SummaryAsideProps {
  title: string;
  description: string;
  tokenTypeLabelLabel: string;
  tokenTypeLabel: string;
  rows: SummaryRow[];
  deployNetworkLabelLabel: string;
  deployNetworkLabel: string;
  completeLabel: string;
  requiredLabel: string;
  walletsIncompleteAlert?: { title: string; description: string } | null;
}

export function SummaryAside({
  title,
  description,
  tokenTypeLabelLabel,
  tokenTypeLabel,
  rows,
  deployNetworkLabelLabel,
  deployNetworkLabel,
  completeLabel,
  requiredLabel,
  walletsIncompleteAlert,
}: SummaryAsideProps): React.JSX.Element {
  return (
    <aside className="lg:sticky lg:top-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{tokenTypeLabelLabel}</span>
            <span className="text-right font-medium">{tokenTypeLabel}</span>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between"
              >
                <span className="text-sm">{row.label}</span>
                {row.complete ? (
                  <Check
                    className="size-4 text-primary"
                    aria-label={completeLabel}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {requiredLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {deployNetworkLabelLabel}
            </span>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              <span className="font-medium">{deployNetworkLabel}</span>
            </div>
          </div>
          {walletsIncompleteAlert ? (
            <Alert>
              <Info className="size-4" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <AlertTitle>{walletsIncompleteAlert.title}</AlertTitle>
                <AlertDescription>
                  {walletsIncompleteAlert.description}
                </AlertDescription>
              </div>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}

/**
 * BottomActionBar —— 底部提交栏。submit 按钮用 `form` 属性关联表单（bar 渲染在
 * form 元素之外，跨双栏全宽），点击触发关联 form 的 onSubmit。逻辑零改动。
 */
export interface BottomActionBarProps {
  onBack: () => void;
  backLabel: string;
  submitLabel: string;
  loading?: boolean;
  formId: string;
  previousLabel?: string;
  nextLabel?: string;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function BottomActionBar({
  onBack,
  backLabel,
  submitLabel,
  loading = false,
  formId,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: BottomActionBarProps): React.JSX.Element {
  return (
    <div className="sticky bottom-0 z-30 border-t bg-card/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Button>
        <div className="flex items-center gap-3">
          {onPrevious && previousLabel ? (
            <Button variant="outline" onClick={onPrevious} disabled={loading}>
              <ArrowLeft className="size-4" />
              {previousLabel}
            </Button>
          ) : null}
          {onNext && nextLabel ? (
            <Button onClick={onNext} disabled={loading}>
              {nextLabel}
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" form={formId} disabled={loading}>
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
