import type { Config } from 'tailwindcss';
import { colorVariables, hslVar } from './colors';
import { keyframes, animation } from './animations';
import { fontFamily } from './typography';

// Shared Tailwind theme extension.
// Spread into theme.extend in any app-level tailwind.config.ts.
// Centralises semantic colours, border-radius, animations, and font stacks.

export const sharedTheme: Config['theme'] = {
  extend: {
    colors: {
      background: hslVar(colorVariables.background),
      foreground: hslVar(colorVariables.foreground),

      primary: {
        DEFAULT: hslVar(colorVariables.primary),
        foreground: hslVar(colorVariables['primary-foreground']),
      },
      secondary: {
        DEFAULT: hslVar(colorVariables.secondary),
        foreground: hslVar(colorVariables['secondary-foreground']),
      },
      muted: {
        DEFAULT: hslVar(colorVariables.muted),
        foreground: hslVar(colorVariables['muted-foreground']),
      },
      accent: {
        DEFAULT: hslVar(colorVariables.accent),
        foreground: hslVar(colorVariables['accent-foreground']),
      },
      destructive: {
        DEFAULT: hslVar(colorVariables.destructive),
        foreground: hslVar(colorVariables['destructive-foreground']),
      },

      border: hslVar(colorVariables.border),
      input: hslVar(colorVariables.input),
      ring: hslVar(colorVariables.ring),

      card: {
        DEFAULT: hslVar(colorVariables.card),
        foreground: hslVar(colorVariables['card-foreground']),
      },
      popover: {
        DEFAULT: hslVar(colorVariables.popover),
        foreground: hslVar(colorVariables['popover-foreground']),
      },
    },

    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },

    keyframes,
    animation,

    fontFamily: {
      sans: fontFamily.sans,
      mono: fontFamily.mono,
      display: fontFamily.display,
    },
  },
};
