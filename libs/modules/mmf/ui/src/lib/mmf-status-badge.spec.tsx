/**
 * MmfStatusBadge 单测 —— 渲染层状态色映射。
 *
 * 验收（mmf.md 第9章「状态色映射」）：
 *   纯静态查表（util/mmf.constants.spec.ts）只覆盖「常量值正确」，
 *   本 spec 覆盖「组件运行时把 status 映射到正确 Tailwind tone class」，
 *   即源 `<Tag color={approvalTaskStatus[status]}>` 的最终视觉效果。
 *
 * 三种业务类型各取一个代表状态断言 tone class，外加 null 兜底与未知状态兜底。
 * next-intl 经 ui jest.config 的 moduleNameMapper 替换为 CJS stub（见
 * __mocks__/next-intl.ts），@swc/jest 不再触碰 next-intl 的 ESM 产物。
 *
 * Plain-DOM 断言（无 jest-dom），对齐 travel-rule-status-badge.spec 风格。
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import { MmfStatusBadge } from './mmf-status-badge';

const badgeClass = (container: HTMLElement): string =>
  container.querySelector('span')?.className ?? '';

const badgeText = (container: HTMLElement): string =>
  container.querySelector('span')?.textContent ?? '';

describe('MmfStatusBadge — runtime status → tone class mapping', () => {
  // ── accrual（3 态）──
  it('maps accrual status 5 → orange tone', () => {
    const cls = badgeClass(
      render(<MmfStatusBadge kind="accrual" status={5} />).container,
    );
    expect(cls).toContain('bg-orange-50');
    expect(cls).toContain('text-orange-700');
  });

  it('maps accrual status 10 → processing(blue) tone', () => {
    expect(
      badgeClass(
        render(<MmfStatusBadge kind="accrual" status={10} />).container,
      ),
    ).toContain('bg-blue-50');
  });

  it('maps accrual status 35 → success(green) tone', () => {
    expect(
      badgeClass(
        render(<MmfStatusBadge kind="accrual" status={35} />).container,
      ),
    ).toContain('bg-green-50');
  });

  // ── settlement（6 态，取 error 分支验证 15/40 走红）──
  it('maps settlement status 15 → error(red) tone', () => {
    const cls = badgeClass(
      render(<MmfStatusBadge kind="settlement" status={15} />).container,
    );
    expect(cls).toContain('bg-red-50');
    expect(cls).toContain('text-red-700');
  });

  it('maps settlement status 40 → error(red) tone (rejected)', () => {
    expect(
      badgeClass(
        render(<MmfStatusBadge kind="settlement" status={40} />).container,
      ),
    ).toContain('bg-red-50');
  });

  // ── settlement-wallet-record（4 态）──
  it('maps settlement-wallet-record status 30 → processing(blue) tone', () => {
    expect(
      badgeClass(
        render(
          <MmfStatusBadge kind="settlement-wallet-record" status={30} />,
        ).container,
      ),
    ).toContain('bg-blue-50');
  });

  it('maps settlement-wallet-record status 35 → success(green) tone', () => {
    expect(
      badgeClass(
        render(
          <MmfStatusBadge kind="settlement-wallet-record" status={35} />,
        ).container,
      ),
    ).toContain('bg-green-50');
  });
});

describe('MmfStatusBadge — fallbacks', () => {
  it('renders the fallback when status is null (no crash, no tone class)', () => {
    const { container } = render(
      <MmfStatusBadge kind="accrual" status={null} />,
    );
    expect(badgeText(container)).toBe('--');
    // 兜底分支不挂 tone class（无 bg-orange/blue/green/red）。
    expect(badgeClass(container)).not.toContain('bg-orange-50');
  });

  it('renders a custom fallback when provided', () => {
    expect(
      badgeText(
        render(
          <MmfStatusBadge kind="settlement" status={undefined} fallback="N/A" />,
        ).container,
      ),
    ).toBe('N/A');
  });

  it('falls back to the default (gray) tone for an unmapped status', () => {
    // 999 不在任何 COLOR 映射中 → DEFAULT_TONE_CLASS（gray）。
    expect(
      badgeClass(
        render(<MmfStatusBadge kind="accrual" status={999} />).container,
      ),
    ).toContain('bg-gray-50');
  });
});

describe('MmfStatusBadge — i18n label key resolution', () => {
  it('builds the label key from kind prefix + status (accrual)', () => {
    // next-intl stub 回显 `modules.mmf.<key>`；组件拼 `${prefix}${status}`。
    expect(
      badgeText(
        render(<MmfStatusBadge kind="accrual" status={5} />).container,
      ),
    ).toBe('modules.mmf.status.mmf_distribution_status_5');
  });

  it('builds the label key from kind prefix + status (settlement-wallet-record)', () => {
    expect(
      badgeText(
        render(
          <MmfStatusBadge kind="settlement-wallet-record" status={40} />,
        ).container,
      ),
    ).toBe('modules.mmf.status.mmf_settlement_records_status_40');
  });
});
