/**
 * CopyableId 组件级单测：框选页面上可见的中段截断标识符再复制，剪贴板必须拿到
 * **全量**标识符（用户反馈「复制后少几个字符」）。
 *
 * 组件渲染的是 `head…tail`，复制按钮走的也是全量值——两条路径口径必须一致。
 */
import * as React from 'react';
import { render } from '@testing-library/react';

import { CopyableId } from './proto-ui';

// shared/ui 的 barrel 会带出 mock-login → util-i18n → next-intl（纯 ESM，
// @swc/jest 无法转换 node_modules 里的 ESM）。这里整体替换 util-i18n：
// 本 spec 只关心剪贴板内容，不涉及 i18n 导航。
jest.mock('@myorg/shared/util-i18n', () => ({
  usePathname: jest.fn(() => '/en-US'),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  Link: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
    ({ children, ...props }, ref) => (
      <a ref={ref} {...props}>
        {children}
      </a>
    ),
  ),
}));

// Radix Popper（tooltip 箭头）会观察尺寸，jsdom 无布局引擎。
class ResizeObserverStub {
  observe() { /* noop */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

const FULL = '0x1234567890abcdefABCDEF1234567890abcdef';
const DISPLAY = `${FULL.slice(0, 8)}…${FULL.slice(-8)}`;

/** 框选节点内容并派发带桩 clipboardData 的 copy 事件，返回桩。 */
function copySelectionOf(node: Node): { setData: jest.Mock } {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const setData = jest.fn();
  const event = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { setData, getData: () => '', types: [], items: [] },
  });
  node.dispatchEvent(event);
  return { setData };
}

describe('CopyableId — 框选复制得到全量标识符', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  it('renders the middle-truncated display text', () => {
    const { container } = render(<CopyableId value={FULL} />);
    expect(container.textContent).toContain(DISPLAY);
    expect(container.textContent).not.toContain(FULL);
  });

  it('copies the full identifier when the visible text is selected', () => {
    const { container } = render(<CopyableId value={FULL} />);
    const display = container.querySelector('span > span');
    expect(display).not.toBeNull();

    const { setData } = copySelectionOf(display as Node);

    expect(setData).toHaveBeenCalledWith('text/plain', FULL);
  });

  it('does not hijack a selection spanning another cell', () => {
    const { container } = render(
      <>
        <CopyableId value={FULL} />
        <span data-testid="other">other</span>
      </>,
    );
    const display = container.querySelector('span > span') as Node;
    const other = container.querySelector('[data-testid="other"]') as Node;
    const range = document.createRange();
    range.setStart(display.firstChild as Node, 0);
    range.setEnd(other.firstChild as Node, 1);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const setData = jest.fn();
    const event = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { setData, getData: () => '', types: [], items: [] },
    });
    display.dispatchEvent(event);

    expect(setData).not.toHaveBeenCalled();
  });
});
