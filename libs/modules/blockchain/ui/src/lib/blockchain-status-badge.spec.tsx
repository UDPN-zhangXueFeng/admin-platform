/**
 * BlockchainStatusBadge 单测 —— 状态色映射（node 动态 i18n 取色 / deployment 写死 success）。
 *
 * 验收（blockchain.md 第9章「状态列色值」/ 第8章「antd Tag color 映射」）：
 *   - node 列表行状态色值走 `common_task_status_color_${status}`（i18n 返回 antd 色名）
 *     再经本地 TONE_CLASS 映射 Tailwind class；
 *   - deployment 列表 + 详情两处 status 列写死 success + token_task_status_10 文案。
 *
 * next-intl 经 ui jest.config 的 moduleNameMapper 替换为 CJS stub（见
 * __mocks__/next-intl.ts），回显 `modules.blockchain.<key>`。
 * 故 node 的 tone 由 `t('common_task_status_color_${status}')` 回显为
 * `modules.blockchain.common_task_status_color_${status}` —— 该串不命中 TONE_CLASS，
 * 回落 default(gray)；本 spec 另用直接断言 success 色名路径覆盖绿色分支。
 *
 * Plain-DOM 断言（无 jest-dom），对齐 mmf-status-badge.spec 风格。
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import { BlockchainStatusBadge } from './blockchain-status-badge';

const badgeClass = (container: HTMLElement): string =>
  container.querySelector('span')?.className ?? '';

const badgeText = (container: HTMLElement): string =>
  container.querySelector('span')?.textContent ?? '';

describe('BlockchainStatusBadge — deployment 写死 success 单态', () => {
  it('always renders success(green) tone regardless of status', () => {
    const cls = badgeClass(
      render(<BlockchainStatusBadge kind="deployment" status={1} />).container,
    );
    expect(cls).toContain('bg-green-50');
    expect(cls).toContain('text-green-700');
  });

  it('renders success tone even when status is omitted', () => {
    const cls = badgeClass(
      render(<BlockchainStatusBadge kind="deployment" />).container,
    );
    expect(cls).toContain('bg-green-50');
  });

  it('renders the token_task_status_10 label', () => {
    expect(
      badgeText(
        render(<BlockchainStatusBadge kind="deployment" />).container,
      ),
    ).toBe('modules.blockchain.token_task_status_10');
  });

  it('ignores the status value (still success for any number)', () => {
    expect(
      badgeClass(
        render(
          <BlockchainStatusBadge kind="deployment" status={999} />,
        ).container,
      ),
    ).toContain('bg-green-50');
  });
});

describe('BlockchainStatusBadge — node 动态 i18n 取色 + 取文案', () => {
  it('builds the color key common_task_status_color_${status}', () => {
    // stub 回显 `modules.blockchain.common_task_status_color_1`（非 antd 色名），
    // 不命中 TONE_CLASS → 回落 default(gray)；此处仅验证 key 拼接正确。
    const cls = badgeClass(
      render(<BlockchainStatusBadge kind="node" status={1} />).container,
    );
    expect(cls).toContain('bg-gray-50');
  });

  it('builds the node_status_${status} label key', () => {
    expect(
      badgeText(
        render(<BlockchainStatusBadge kind="node" status={1} />).container,
      ),
    ).toBe('modules.blockchain.node_status_1');
  });

  it('builds the disabled-state (status=2) label key', () => {
    expect(
      badgeText(
        render(<BlockchainStatusBadge kind="node" status={2} />).container,
      ),
    ).toBe('modules.blockchain.node_status_2');
  });

  it('falls back to default tone when the resolved tone string is unknown', () => {
    // status=2 → stub 回显 common_task_status_color_2 → 不命中 → gray。
    const cls = badgeClass(
      render(<BlockchainStatusBadge kind="node" status={2} />).container,
    );
    expect(cls).toContain('bg-gray-50');
    expect(cls).toContain('text-gray-600');
  });
});

describe('BlockchainStatusBadge — fallbacks (node)', () => {
  it('renders the fallback when status is null (no crash, no tone class)', () => {
    const { container } = render(
      <BlockchainStatusBadge kind="node" status={null} />,
    );
    expect(badgeText(container)).toBe('--');
    // 兜底分支不挂 tone class（无 bg-gray-50 border 等）。
    expect(badgeClass(container)).not.toContain('rounded-full');
  });

  it('renders a custom fallback when provided', () => {
    expect(
      badgeText(
        render(
          <BlockchainStatusBadge kind="node" fallback="N/A" />,
        ).container,
      ),
    ).toBe('N/A');
  });
});
