'use client';

import * as React from 'react';
import { useTheme } from '@myorg/shared/util-config';

/**
 * 外观/调色板 mount 重放（hydration 补偿）。
 *
 * root layout 的两段防闪 inline script 在首帧前写 `html.dark`（键
 * 'gw-appearance'，system-ui-pages 外观轴）与 `html[data-theme]`（键
 * 'gw-theme'，ThemeInjector 调色板轴），但 React 19 hydration 会把 SSR
 * HTML 里不存在的 `<html>` 属性/class 整体剥掉——本组件挂载时按防闪
 * 脚本同款语义重放：外观取存储值；调色板取存储 id，非法/缺失回落
 * config.theme.defaultTheme（与 layout restoreScript 完全一致）。
 * 行为对齐 next-themes Provider 的 mount 同步。
 *
 * 存储键与 layout.tsx 防闪脚本、feature 库（system-ui-pages /
 * theme-switcher）的字面量保持一致（沿用既有 'gw-theme' 双处字面量约定）。
 */
export function AppearanceSync() {
  const theme = useTheme();

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    try {
      root.classList.toggle(
        'dark',
        window.localStorage.getItem('gw-appearance') === 'dark',
      );
      const ids = (theme?.themes ?? []).map((t) => t.id);
      let next = window.localStorage.getItem('gw-theme');
      if (!ids.includes(next ?? '')) next = theme?.defaultTheme ?? null;
      if (next) root.dataset.theme = next;
    } catch {
      /* 存储不可用（隐私模式等）：维持防闪脚本已应用的状态 */
    }
  }, [theme?.themes, theme?.defaultTheme]);

  return null;
}
