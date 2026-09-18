'use client';

import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  History,
  Loader2,
  RotateCcw,
  Send,
} from 'lucide-react';
import { Button } from '@myorg/shared/ui';

/**
 * Onboard 向导 chrome（对齐参考实现 token/components/token-onboard 的 v0 向导风）。
 *
 * 四个纯展示组件，仅服务 `mode='add'` 新建页；数据与回调由 FormContent 传入。
 * 与 page-shell.tsx（edit 页 chrome）并存，互不影响。
 *
 * 样式约定：本模块不使用 cn()，条件类名用模板字符串（对齐 page-shell.tsx）。
 */

// ── WizardHeader：页头（eyebrow + 标题 + 描述）──

export interface WizardHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function WizardHeader({
  eyebrow,
  title,
  description,
}: WizardHeaderProps): React.JSX.Element {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

// ── DraftBanner：草稿恢复横幅 ──

export interface DraftBannerProps {
  /** 已含时间的完整文案（i18n 插值后传入）。 */
  text: string;
  resumeLabel: string;
  discardLabel: string;
  /** 下拉数据（链/币种）未加载时禁用 Resume——恢复依赖列表重导桥接 state，
   * 且 mount 默认值 effect 会在列表到达时覆盖恢复值。 */
  resumeDisabled?: boolean;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftBanner({
  text,
  resumeLabel,
  discardLabel,
  resumeDisabled = false,
  onResume,
  onDiscard,
}: DraftBannerProps): React.JSX.Element {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-md border border-primary/20 bg-accent px-4 py-3 sm:flex-row sm:items-center">
      <History className="hidden size-4 shrink-0 text-primary sm:block" />
      <p className="flex-1 text-sm text-accent-foreground">{text}</p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" disabled={resumeDisabled} onClick={onResume}>
          {resumeLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onDiscard}>
          {discardLabel}
        </Button>
      </div>
    </div>
  );
}

// ── WizardStepper：顶部步骤条（圆圈 + 连接线，前跳受 maxReached 门控）──

export interface WizardStepDef {
  key: string;
  title: string;
  description: string;
}

export interface WizardStepperProps {
  steps: WizardStepDef[];
  current: number;
  maxReached: number;
  onNavigate: (index: number) => void;
  /** 移动端文案（i18n 插值后传入），如 `Step 2 of 4: Accounting`。 */
  mobileCurrentLabel: string;
}

export function WizardStepper({
  steps,
  current,
  maxReached,
  onNavigate,
  mobileCurrentLabel,
}: WizardStepperProps): React.JSX.Element {
  return (
    <nav
      aria-label="Onboarding progress"
      className="border-b border-border bg-card px-5 py-5 sm:px-8"
    >
      <ol className="mx-auto flex max-w-4xl items-start">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          const reachable = index <= maxReached;
          return (
            <li
              key={step.key}
              className="relative flex flex-1 flex-col items-center text-center"
            >
              {index > 0 ? (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-4 h-px w-full ${
                    index <= current ? 'bg-primary' : 'bg-border'
                  }`}
                />
              ) : null}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onNavigate(index)}
                aria-current={active ? 'step' : undefined}
                className={`relative z-10 flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 ${
                  reachable ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    complete
                      ? 'border-primary bg-primary text-primary-foreground'
                      : active
                        ? 'border-primary bg-card text-primary ring-4 ring-primary/10'
                        : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  {complete ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span
                    className={`block text-xs font-semibold ${
                      active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="mt-0.5 hidden text-[11px] leading-4 text-muted-foreground lg:block">
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs font-medium text-muted-foreground sm:hidden">
        {mobileCurrentLabel}
      </p>
    </nav>
  );
}

// ── WizardFooter：卡片底部导航（左 Reset / 右 Back + Continue|Submit）──

export interface WizardFooterProps {
  resetLabel: string;
  backLabel: string;
  continueLabel: string;
  submitLabel: string;
  /** 当前是否首步（隐藏 Back）。 */
  isFirstStep: boolean;
  /** 当前是否末步（Submit 替代 Continue）。 */
  isLastStep: boolean;
  loading?: boolean;
  onReset: () => void;
  onBack: () => void;
  onContinue: () => void;
}

/**
 * 渲染在 `<form>` 内部：Reset/Back/Continue 显式 `type="button"` 防误提交；
 * 末步 Submit 为 `type="submit"`，由父级 form 的 onSubmit（handleSubmit 包装，
 * 含确认 AlertDialog）接管。
 */
export function WizardFooter({
  resetLabel,
  backLabel,
  continueLabel,
  submitLabel,
  isFirstStep,
  isLastStep,
  loading = false,
  onReset,
  onBack,
  onContinue,
}: WizardFooterProps): React.JSX.Element {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-center text-muted-foreground sm:justify-start"
        disabled={loading}
        onClick={onReset}
      >
        <RotateCcw className="size-4" />
        {resetLabel}
      </Button>
      <div className="flex justify-end gap-3">
        {!isFirstStep ? (
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Button>
        ) : null}
        {!isLastStep ? (
          <Button
            key="continue"
            type="button"
            disabled={loading}
            onClick={onContinue}
          >
            {continueLabel}
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button key="submit" type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
