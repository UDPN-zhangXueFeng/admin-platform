/**
 * CrossChainStatusBadge 单测 —— 5 子模块状态色映射 + i18n 文案拼接。
 *
 * 验收（cross-chain.md 第9章）：
 *   - 5 子模块各自 status 走对应常量取色（antd 色名 → TONE_CLASS → Tailwind class）。
 *   - 文案走 i18n key `${LABEL_KEY_PREFIX_MAP[kind]}${status}` 动态拼接。
 *   - fx-rate 无状态枚举，不在 kind 中（无需测）。
 *   - LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX 保留 "ststus" 拼写错误。
 *
 * next-intl 经 ui jest.config 的 moduleNameMapper 替换为 CJS stub（见
 * __mocks__/next-intl.ts），回显 `modules.cross-chain.<key>`。
 *
 * Plain-DOM 断言（无 jest-dom），对齐 blockchain-status-badge.spec 风格。
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import { CrossChainStatusBadge } from './cross-chain-status-badge';

const badgeClass = (container: HTMLElement): string =>
  container.querySelector('span')?.className ?? '';

const badgeText = (container: HTMLElement): string =>
  container.querySelector('span')?.textContent ?? '';

describe('CrossChainStatusBadge — cross-chain-tx', () => {
  it('status=35 → success (green)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="cross-chain-tx" status={35} />,
      ).container,
    );
    expect(cls).toContain('bg-green-50');
    expect(cls).toContain('text-green-700');
  });

  it('status=20 → orange', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="cross-chain-tx" status={20} />,
      ).container,
    );
    expect(cls).toContain('bg-orange-50');
    expect(cls).toContain('text-orange-700');
  });

  it('status=40 → error (red)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="cross-chain-tx" status={40} />,
      ).container,
    );
    expect(cls).toContain('bg-red-50');
    expect(cls).toContain('text-red-700');
  });

  it('label key = cross_chain_transactions_status_${status}', () => {
    expect(
      badgeText(
        render(
          <CrossChainStatusBadge kind="cross-chain-tx" status={35} />,
        ).container,
      ),
    ).toBe('modules.cross-chain.cross_chain_transactions_status_35');
  });
});

describe('CrossChainStatusBadge — liquidity-pool', () => {
  it('status=5 → success (green)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="liquidity-pool" status={5} />,
      ).container,
    );
    expect(cls).toContain('bg-green-50');
  });

  it('status=0 → default (gray)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="liquidity-pool" status={0} />,
      ).container,
    );
    expect(cls).toContain('bg-gray-50');
  });

  it('status=1 → processing (blue)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="liquidity-pool" status={1} />,
      ).container,
    );
    expect(cls).toContain('bg-blue-50');
  });

  it('label key = liquidity_pool_status_${status}', () => {
    expect(
      badgeText(
        render(
          <CrossChainStatusBadge kind="liquidity-pool" status={5} />,
        ).container,
      ),
    ).toBe('modules.cross-chain.liquidity_pool_status_5');
  });
});

describe('CrossChainStatusBadge — liquidity-pool-tx', () => {
  it('status=35 → success (green)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="liquidity-pool-tx" status={35} />,
      ).container,
    );
    expect(cls).toContain('bg-green-50');
  });

  it('status=40 → error (red)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="liquidity-pool-tx" status={40} />,
      ).container,
    );
    expect(cls).toContain('bg-red-50');
  });

  it('label key preserves source typo "ststus"', () => {
    expect(
      badgeText(
        render(
          <CrossChainStatusBadge kind="liquidity-pool-tx" status={35} />,
        ).container,
      ),
    ).toBe('modules.cross-chain.liquidity_pool_transaction_ststus_35');
  });
});

describe('CrossChainStatusBadge — rd-bridge', () => {
  it('status=35 → success (green, 启用)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="rd-bridge" status={35} />,
      ).container,
    );
    expect(cls).toContain('bg-green-50');
  });

  it('status=50 → gray (禁用)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="rd-bridge" status={50} />,
      ).container,
    );
    expect(cls).toContain('bg-gray-50');
    expect(cls).toContain('text-gray-600');
  });

  it('label key = cross_chain_status_${status}', () => {
    expect(
      badgeText(
        render(
          <CrossChainStatusBadge kind="rd-bridge" status={50} />,
        ).container,
      ),
    ).toBe('modules.cross-chain.cross_chain_status_50');
  });
});

describe('CrossChainStatusBadge — token-pair', () => {
  it('status=5 → success (green, 启用)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="token-pair" status={5} />,
      ).container,
    );
    expect(cls).toContain('bg-green-50');
  });

  it('status=3 → gray (禁用)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="token-pair" status={3} />,
      ).container,
    );
    expect(cls).toContain('bg-gray-50');
  });

  it('status=1 → processing (blue, 处理中)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="token-pair" status={1} />,
      ).container,
    );
    expect(cls).toContain('bg-blue-50');
  });

  it('status=10 → gray (禁用另一态)', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="token-pair" status={10} />,
      ).container,
    );
    expect(cls).toContain('bg-gray-50');
  });

  it('label key = token_pair_status_${status}', () => {
    expect(
      badgeText(
        render(
          <CrossChainStatusBadge kind="token-pair" status={5} />,
        ).container,
      ),
    ).toBe('modules.cross-chain.token_pair_status_5');
  });
});

describe('CrossChainStatusBadge — fallbacks', () => {
  it('renders fallback when status is null', () => {
    const { container } = render(
      <CrossChainStatusBadge kind="cross-chain-tx" status={null} />,
    );
    expect(badgeText(container)).toBe('--');
    expect(badgeClass(container)).not.toContain('rounded-full');
  });

  it('renders fallback when status is undefined', () => {
    const { container } = render(
      <CrossChainStatusBadge kind="cross-chain-tx" />,
    );
    expect(badgeText(container)).toBe('--');
  });

  it('renders custom fallback', () => {
    expect(
      badgeText(
        render(
          <CrossChainStatusBadge kind="cross-chain-tx" fallback="N/A" />,
        ).container,
      ),
    ).toBe('N/A');
  });
});

describe('CrossChainStatusBadge — unknown status falls back to default tone', () => {
  it('status not in color map → default gray', () => {
    const cls = badgeClass(
      render(
        <CrossChainStatusBadge kind="cross-chain-tx" status={999} />,
      ).container,
    );
    expect(cls).toContain('bg-gray-50');
  });
});
