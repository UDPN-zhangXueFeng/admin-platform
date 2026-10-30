/**
 * 选区复制（copy-selection）单测。
 *
 * 验收点（用户反馈「复制后少几个字符」）：
 *   1. 页面渲染的是中段截断文本（`head…tail`），框选它按 Ctrl/⌘+C 时，
 *      剪贴板必须拿到**全量**标识符，而不是截断串；
 *   2. 选区跨出本组件（多选单元格）时不接管，保持浏览器默认行为，
 *      避免把整段多选替换成单个标识符。
 *
 * jsdom 无 ClipboardEvent，故用普通 Event + 桩 clipboardData 模拟 copy 事件；
 * Clipboard API 规范下不可编辑选区的 copy 事件派发在 body/document，
 * 因此断言的是 document 级监听器的行为。
 */
import * as React from 'react';
import { render } from '@testing-library/react';

import { useFullValueCopySelection } from './copy-selection';

const FULL = '0x1234567890abcdefABCDEF1234567890abcdef';

/** 组件：把可见文本放进被登记的容器，模拟 CopyableId 的中段截断渲染。 */
function Identifier({
  fullText,
  displayText,
  ref,
}: {
  fullText: string;
  displayText: string;
  ref: React.RefObject<HTMLSpanElement | null>;
}) {
  useFullValueCopySelection(ref, fullText);
  return (
    <span ref={ref} data-testid="id">
      {displayText}
    </span>
  );
}

/** 把选区落在给定节点的内容上（模拟用户框选页面上的可见文本）。 */
function selectNode(node: Node): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** 派发一个带桩 clipboardData 的 copy 事件，返回桩与是否被 preventDefault。 */
function fireCopy(target: Node): {
  setData: jest.Mock;
  defaultPrevented: boolean;
} {
  const setData = jest.fn();
  const event = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { setData, getData: () => '', types: [], items: [] },
  });
  target.dispatchEvent(event);
  return { setData, defaultPrevented: event.defaultPrevented };
}

describe('useFullValueCopySelection — 框选复制拿到全量标识符', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  it('writes the full value to the clipboard when the selection is inside the identifier', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const { getByTestId } = render(
      <Identifier
        ref={ref}
        fullText={FULL}
        displayText={`${FULL.slice(0, 8)}…${FULL.slice(-8)}`}
      />,
    );
    const node = getByTestId('id');
    selectNode(node);

    const { setData, defaultPrevented } = fireCopy(node);

    expect(setData).toHaveBeenCalledWith('text/plain', FULL);
    expect(defaultPrevented).toBe(true);
  });

  it('does not hijack a selection that spans outside the identifier', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const { getByTestId } = render(
      <>
        <Identifier ref={ref} fullText={FULL} displayText="truncated" />
        <span data-testid="other">other cell</span>
      </>,
    );
    const node = getByTestId('id');
    const other = getByTestId('other');
    // 选区从组件内跨到组件外（模拟跨单元格多选）。
    const range = document.createRange();
    range.setStart(node.firstChild as Node, 0);
    range.setEnd(other.firstChild as Node, 1);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const { setData, defaultPrevented } = fireCopy(node);

    expect(setData).not.toHaveBeenCalled();
    expect(defaultPrevented).toBe(false);
  });

  it('ignores a collapsed selection (no text selected)', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const { getByTestId } = render(
      <Identifier ref={ref} fullText={FULL} displayText="truncated" />,
    );
    const node = getByTestId('id');
    const range = document.createRange();
    range.collapse(true);
    range.setStart(node.firstChild as Node, 0);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const { setData } = fireCopy(node);

    expect(setData).not.toHaveBeenCalled();
  });

  it('stops intercepting after unmount', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const { getByTestId, unmount } = render(
      <Identifier ref={ref} fullText={FULL} displayText="truncated" />,
    );
    const node = getByTestId('id');
    unmount();

    const { setData } = fireCopy(node);

    expect(setData).not.toHaveBeenCalled();
  });
});
