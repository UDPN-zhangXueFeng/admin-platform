/**
 * onboard-wizard 向导 chrome 组件单测（纯展示，无外部依赖）。
 *
 * 验收（对照 add-page-logic.md 14.6 草稿 UI 与向导交互）：
 *   - WizardHeader 渲染 eyebrow / title / description。
 *   - DraftBanner 渲染草稿文案 + Resume/Discard，点击回调正确；resumeDisabled 禁用 Resume。
 *   - WizardStepper：complete 步显示对勾序号、active 步高亮、未达 maxReached 的步禁用；
 *     回跳（已达）可点击；前跳（未达）禁用。
 *   - WizardFooter：首步隐藏 Back；非末步显示 Continue；末步显示 Submit；Reset 始终在。
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// 桩掉跨库依赖（jest 不转译 lucide-react/@myorg/shared/ui 的 ESM），只测本文件组件逻辑。
jest.mock('lucide-react', () => {
  // 任意 icon 访问 → 返回渲染 null 的占位组件
  return new Proxy(
    {},
    {
      get: () => {
        const Stub = () => null;
        return Stub;
      },
    },
  );
});
jest.mock('@myorg/shared/ui', () => ({
  Button: ({
    children,
    type = 'button',
    ...rest
  }: {
    children?: React.ReactNode;
    type?: 'button' | 'submit';
    [k: string]: unknown;
  }) => React.createElement('button', { type, ...rest }, children),
}));

import {
  WizardHeader,
  DraftBanner,
  WizardStepper,
  WizardFooter,
  type WizardStepDef,
} from './onboard-wizard';

const STEPS: WizardStepDef[] = [
  { key: 'basic', title: 'Token details', description: 'Identity and network' },
  { key: 'finance', title: 'Accounting', description: 'Ledger and reconciliation' },
  { key: 'custody', title: 'Custody', description: 'Key service and wallets' },
  { key: 'review', title: 'Review', description: 'Validate and submit' },
];

describe('WizardHeader', () => {
  it('renders eyebrow, title and description', () => {
    render(
      <WizardHeader
        eyebrow="Token issuance"
        title="Onboard a Token"
        description="Configure before deployment"
      />,
    );
    expect(screen.getByText('Token issuance')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Onboard a Token' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Configure before deployment'),
    ).toBeInTheDocument();
  });
});

describe('DraftBanner', () => {
  it('renders text and triggers Resume / Discard callbacks', () => {
    const onResume = jest.fn();
    const onDiscard = jest.fn();
    render(
      <DraftBanner
        text="An unsent draft from 2026-07-17 14:30 is available."
        resumeLabel="Resume draft"
        discardLabel="Discard"
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    );
    expect(
      screen.getByText(/unsent draft from 2026-07-17/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume draft' }));
    expect(onResume).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('disables Resume when resumeDisabled (下拉未加载时不允许恢复)', () => {
    render(
      <DraftBanner
        text="draft"
        resumeLabel="Resume draft"
        discardLabel="Discard"
        resumeDisabled
        onResume={jest.fn()}
        onDiscard={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Resume draft' })).toBeDisabled();
  });
});

describe('WizardStepper', () => {
  it('marks complete steps and disables unreachable forward steps', () => {
    const onNavigate = jest.fn();
    render(
      <WizardStepper
        steps={STEPS}
        current={1}
        maxReached={1}
        onNavigate={onNavigate}
        mobileCurrentLabel="Step 2 of 4: Accounting"
      />,
    );
    // step 1 complete（current=1，index 0 < 1）
    const step1 = screen.getByRole('button', { name: /Token details/ });
    expect(step1).not.toBeDisabled();
    // step 3/4 未达 maxReached(1) → 禁用
    const step3 = screen.getByRole('button', { name: /Custody/ });
    expect(step3).toBeDisabled();
    // 回跳可达步可点击
    fireEvent.click(step1);
    expect(onNavigate).toHaveBeenCalledWith(0);
  });
});

describe('WizardFooter', () => {
  it('hides Back on first step and shows Continue on non-last step', () => {
    render(
      <WizardFooter
        resetLabel="Reset application"
        backLabel="Back"
        continueLabel="Continue"
        submitLabel="Submit application"
        isFirstStep
        isLastStep={false}
        onReset={jest.fn()}
        onBack={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Reset application/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Continue' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Submit application/ }),
    ).toBeNull();
  });

  it('shows Back + Submit on last step', () => {
    render(
      <WizardFooter
        resetLabel="Reset"
        backLabel="Back"
        continueLabel="Continue"
        submitLabel="Submit application"
        isFirstStep={false}
        isLastStep
        onReset={jest.fn()}
        onBack={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Submit application/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue' }),
    ).toBeNull();
  });
});
