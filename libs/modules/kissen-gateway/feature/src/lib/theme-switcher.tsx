'use client';

/**
 * ThemeSwitcher —— gateway 品牌主题切换（configs/kissen-gateway.json theme.themes）。
 *
 * 只做两件事：写 documentElement.dataset.theme（驱动 layout ThemeInjector 注入的
 * `[data-theme='id']` CSS 变量块）+ 持久化 localStorage['gw-theme']（防闪
 * inline script 的读取键，与 LP 的 'lp-theme' 隔离）。主题定义完全来自配置
 * 传入，组件零内置色；themes < 2 渲染 null。
 *
 * 注意：存储键常量不进 feature barrel（barrel 被断言为组件表，导出非组件
 * 值会炸生产 TS 检查——见 LP 06 §7 踩坑 1）。
 */
import * as React from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@myorg/shared/ui';

import { Check, Palette } from 'lucide-react';

/** localStorage 键，须与 layout ThemeInjector 防闪脚本一致。 */
const GW_THEME_STORAGE_KEY = 'gw-theme';

export interface ThemeSwitcherProps {
  /** 配置驱动的可选主题列表（config.theme.themes 原样传入）。 */
  themes: { id: string; label: string; colors: Record<string, string> }[];
  /** 初始选中主题 id（默认取 documentElement.dataset.theme）。 */
  activeThemeId?: string;
}

export function ThemeSwitcher({ themes, activeThemeId }: ThemeSwitcherProps) {
  const [active, setActive] = React.useState<string>(
    () =>
      activeThemeId ??
      (typeof document === 'undefined'
        ? ''
        : (document.documentElement.dataset.theme ?? '')),
  );

  if (themes.length < 2) return null;

  function applyTheme(id: string) {
    document.documentElement.dataset.theme = id;
    window.localStorage.setItem(GW_THEME_STORAGE_KEY, id);
    setActive(id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Switch theme"
          className="relative text-white/80 hover:bg-white/10 hover:text-white"
        >
          <Palette aria-hidden="true" className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent align="end" className="w-48">
          {themes.map((t) => (
            <DropdownMenuItem key={t.id} onSelect={() => applyTheme(t.id)}>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                style={{
                  background: `linear-gradient(135deg, ${
                    t.colors['brand-deep'] ?? '#334155'
                  } 50%, ${t.colors['brand-accent'] ?? '#94a3b8'} 50%)`,
                }}
              />
              {t.label}
              {active === t.id && (
                <Check aria-hidden="true" className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
