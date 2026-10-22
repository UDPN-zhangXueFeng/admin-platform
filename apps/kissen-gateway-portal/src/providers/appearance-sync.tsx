'use client';

import * as React from 'react';
import { useTheme } from '@myorg/shared/util-config';

/**
 * Appearance/palette mount replay.
 *
 * Existing `gw-appearance` light/dark values remain read-only. UI Setting
 * previews `gw-theme` in memory and persists it only after the brand API save
 * succeeds. React 19 hydration can strip root attributes/classes absent from
 * SSR markup, so this component replays both stored values after mount.
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
