/**
 * Design Tokens — Colors
 *
 * CSS custom property names used by the Tailwind theme.
 * All semantic colors are defined as HSL values so that Tailwind can
 * apply opacity modifiers (e.g. bg-primary/50).
 *
 * Consumers should set these variables in :root (light) and
 * [data-theme="dark"] (dark) or rely on a CSS-in-JS theming layer.
 */

/** Base surface colors */
export const colorVariables = {
  background: '--background',
  foreground: '--foreground',

  primary: '--primary',
  'primary-foreground': '--primary-foreground',

  secondary: '--secondary',
  'secondary-foreground': '--secondary-foreground',

  muted: '--muted',
  'muted-foreground': '--muted-foreground',

  accent: '--accent',
  'accent-foreground': '--accent-foreground',

  destructive: '--destructive',
  'destructive-foreground': '--destructive-foreground',

  border: '--border',
  input: '--input',
  ring: '--ring',

  card: '--card',
  'card-foreground': '--card-foreground',

  popover: '--popover',
  'popover-foreground': '--popover-foreground',
} as const;

/** Helper to generate the hsl(var(--name)) expression used by Tailwind */
export function hslVar(name: string): string {
  return `hsl(var(${name}))`;
}

/**
 * Default light-mode HSL values.
 * These are intentionally opinionated defaults; apps may override them.
 */
export const defaultLightColors: Record<string, string> = {
  [colorVariables.background]: '0 0% 100%',
  [colorVariables.foreground]: '222.2 84% 4.9%',

  [colorVariables.primary]: '222.2 47.4% 11.2%',
  [colorVariables['primary-foreground']]: '210 40% 98%',

  [colorVariables.secondary]: '210 40% 96.1%',
  [colorVariables['secondary-foreground']]: '222.2 47.4% 11.2%',

  [colorVariables.muted]: '210 40% 96.1%',
  [colorVariables['muted-foreground']]: '215.4 16.3% 46.9%',

  [colorVariables.accent]: '210 40% 96.1%',
  [colorVariables['accent-foreground']]: '222.2 47.4% 11.2%',

  [colorVariables.destructive]: '0 84.2% 60.2%',
  [colorVariables['destructive-foreground']]: '210 40% 98%',

  [colorVariables.border]: '214.3 31.8% 91.4%',
  [colorVariables.input]: '214.3 31.8% 91.4%',
  [colorVariables.ring]: '222.2 84% 4.9%',

  [colorVariables.card]: '0 0% 100%',
  [colorVariables['card-foreground']]: '222.2 84% 4.9%',

  [colorVariables.popover]: '0 0% 100%',
  [colorVariables['popover-foreground']]: '222.2 84% 4.9%',
};

/**
 * Default dark-mode HSL values.
 * Maps the same semantic variables to a dark palette.
 */
export const defaultDarkColors: Record<string, string> = {
  [colorVariables.background]: '222.2 84% 4.9%',
  [colorVariables.foreground]: '210 40% 98%',

  [colorVariables.primary]: '210 40% 98%',
  [colorVariables['primary-foreground']]: '222.2 47.4% 11.2%',

  [colorVariables.secondary]: '217.2 32.6% 17.5%',
  [colorVariables['secondary-foreground']]: '210 40% 98%',

  [colorVariables.muted]: '217.2 32.6% 17.5%',
  [colorVariables['muted-foreground']]: '215 20.2% 65.1%',

  [colorVariables.accent]: '217.2 32.6% 17.5%',
  [colorVariables['accent-foreground']]: '210 40% 98%',

  [colorVariables.destructive]: '0 62.8% 30.6%',
  [colorVariables['destructive-foreground']]: '210 40% 98%',

  [colorVariables.border]: '217.2 32.6% 17.5%',
  [colorVariables.input]: '217.2 32.6% 17.5%',
  [colorVariables.ring]: '212.7 26.8% 83.9%',

  [colorVariables.card]: '222.2 84% 4.9%',
  [colorVariables['card-foreground']]: '210 40% 98%',

  [colorVariables.popover]: '222.2 84% 4.9%',
  [colorVariables['popover-foreground']]: '210 40% 98%',
};
