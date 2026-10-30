'use client';

import * as React from 'react';

/**
 * 选区复制 → 全量标识符。
 *
 * 标识符在页面上按「中段截断」展示（`head…tail`），用户用鼠标框选可见文本再按
 * Ctrl/⌘+C 时，浏览器写入剪贴板的是截断串（少了中段字符）；而复制按钮走的是
 * 全量值。两条路径口径必须一致，故在 document 上监听 copy 事件，把落在本组件
 * 容器内的选区改写为全量值。
 *
 * Clipboard API 规范下不可编辑选区的 copy 事件派发在焦点节点（无焦点时是 body），
 * 元素自身的 onCopy 不保证命中，所以监听挂在 document 上。
 *
 * 归属判定用选区两端（start/end container）是否都落在容器内：跨单元格的多选
 * 不满足该条件，保持浏览器默认行为，不会被单个标识符覆盖。
 */

/** 已注册的「容器元素 → 全量值」；一个 app 内共用一份，copy 时按容器命中。 */
const registry = new Map<HTMLElement, string>();

/** document 级监听是否已安装（首个注册时装，最后一个注销时卸）。 */
let listening = false;

function handleCopy(event: ClipboardEvent): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  for (const [element, fullValue] of registry) {
    if (
      !element.contains(range.startContainer) ||
      !element.contains(range.endContainer)
    ) {
      continue;
    }
    const data = event.clipboardData;
    if (!data) return;
    data.setData('text/plain', fullValue);
    event.preventDefault();
    return;
  }
}

/**
 * 把容器登记为「显示可截断、复制给全量」的标识符。
 *
 * @param elementRef 包裹可见标识符文本的容器
 * @param fullValue 复制时应写入剪贴板的全量值
 */
export function useFullValueCopySelection(
  elementRef: React.RefObject<HTMLElement | null>,
  fullValue: string,
): void {
  // 不设依赖数组：每次渲染后都重新登记当前 DOM 节点，节点被替换（remount）时
  // 不会留下指向已卸载节点的陈旧登记。
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element || !fullValue) return;
    registry.set(element, fullValue);
    if (!listening) {
      document.addEventListener('copy', handleCopy);
      listening = true;
    }
    return () => {
      registry.delete(element);
      if (registry.size === 0 && listening) {
        document.removeEventListener('copy', handleCopy);
        listening = false;
      }
    };
  });
}
