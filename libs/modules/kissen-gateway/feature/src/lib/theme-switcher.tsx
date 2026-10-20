'use client';

/**
 * Gateway palette selector used in UI Setting.
 *
 * Palette data comes from config.theme.themes. Selecting an entry updates
 * documentElement.dataset.theme for an in-place preview; the owning form
 * persists gw-theme only after its API save succeeds.
 */

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@myorg/shared/ui';

import { Check, Palette } from 'lucide-react';

export interface ThemeSwitcherProps {
  /** Config-driven palette list (config.theme.themes). */
  themes: { id: string; label: string; colors: Record<string, string> }[];
  /** Currently previewed palette id. */
  activeThemeId: string;
  /** Called after the palette is applied for preview. */
  onThemeSelect: (themeId: string) => void;
}

export function ThemeSwitcher({
  themes,
  activeThemeId,
  onThemeSelect,
}: ThemeSwitcherProps) {
  if (themes.length < 2) return null;

  const activeTheme = themes.find((theme) => theme.id === activeThemeId);

  function previewTheme(id: string) {
    document.documentElement.dataset.theme = id;
    onThemeSelect(id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Preview color theme"
          className="min-w-[180px] justify-start gap-2"
        >
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
            style={{
              background: `linear-gradient(135deg, ${
                activeTheme?.colors['brand-deep'] ?? '#334155'
              } 50%, ${activeTheme?.colors['brand-accent'] ?? '#94a3b8'} 50%)`,
            }}
          />
          <span className="truncate">{activeTheme?.label ?? 'Select theme'}</span>
          <Palette
            aria-hidden="true"
            className="ml-auto h-4 w-4 text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent align="start" className="w-56">
          {themes.map((theme) => (
            <DropdownMenuItem
              key={theme.id}
              onSelect={() => previewTheme(theme.id)}
              className="gap-2"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                style={{
                  background: `linear-gradient(135deg, ${
                    theme.colors['brand-deep'] ?? '#334155'
                  } 50%, ${theme.colors['brand-accent'] ?? '#94a3b8'} 50%)`,
                }}
              />
              {theme.label}
              {activeThemeId === theme.id && (
                <Check aria-hidden="true" className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
