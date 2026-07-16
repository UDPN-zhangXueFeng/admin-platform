/**
 * Design Tokens — Animations
 *
 * Reusable CSS keyframes and animation utilities for Tailwind.
 * These are consumed by `theme.extend.keyframes` and `theme.extend.animation`
 * in the shared Tailwind preset.
 *
 * Naming convention:
 *   <action>-<direction>   e.g. accordion-down, slide-in-left
 *   <action>-<modifier>    e.g. fade-in, spin-slow
 */

export const keyframes = {
  /** Accordion — used by Radix UI Accordion / Collapsible */
  'accordion-down': {
    from: { height: '0' },
    to: { height: 'var(--radix-accordion-content-height)' },
  },
  'accordion-up': {
    from: { height: 'var(--radix-accordion-content-height)' },
    to: { height: '0' },
  },

  /** Fade */
  'fade-in': {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  'fade-out': {
    from: { opacity: '1' },
    to: { opacity: '0' },
  },

  /** Slide in from edges */
  'slide-in-from-top': {
    from: { transform: 'translateY(-100%)' },
    to: { transform: 'translateY(0)' },
  },
  'slide-in-from-bottom': {
    from: { transform: 'translateY(100%)' },
    to: { transform: 'translateY(0)' },
  },
  'slide-in-from-left': {
    from: { transform: 'translateX(-100%)' },
    to: { transform: 'translateX(0)' },
  },
  'slide-in-from-right': {
    from: { transform: 'translateX(100%)' },
    to: { transform: 'translateX(0)' },
  },

  /** Zoom */
  'zoom-in': {
    from: { transform: 'scale(0.95)', opacity: '0' },
    to: { transform: 'scale(1)', opacity: '1' },
  },
  'zoom-out': {
    from: { transform: 'scale(1)', opacity: '1' },
    to: { transform: 'scale(0.95)', opacity: '0' },
  },

  /** Spinner / indeterminate progress */
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },

  /** Pulse — subtle attention cue */
  pulse: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.5' },
  },
} as const;

/** Animation shorthand definitions (name duration easing) */
export const animation = {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',

  'fade-in': 'fade-in 0.2s ease-out',
  'fade-out': 'fade-out 0.2s ease-in',

  'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
  'slide-in-from-bottom': 'slide-in-from-bottom 0.3s ease-out',
  'slide-in-from-left': 'slide-in-from-left 0.3s ease-out',
  'slide-in-from-right': 'slide-in-from-right 0.3s ease-out',

  'zoom-in': 'zoom-in 0.2s ease-out',
  'zoom-out': 'zoom-out 0.2s ease-in',

  spin: 'spin 1s linear infinite',
  'spin-slow': 'spin 3s linear infinite',

  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
} as const;

/** Duration tokens (in seconds) for programmatic use */
export const duration = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
} as const;

/** Easing tokens for programmatic use (e.g. Framer Motion) */
export const easing = {
  default: [0.4, 0, 0.2, 1] as [number, number, number, number],
  in: [0.4, 0, 1, 1] as [number, number, number, number],
  out: [0, 0, 0.2, 1] as [number, number, number, number],
  bounce: [0.68, -0.55, 0.265, 1.55] as [number, number, number, number],
} as const;
