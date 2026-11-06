import { cn } from '@myorg/shared/util-classnames';

/**
 * Visual treatment for the Lucide icons rendered in the primary sidebar menu.
 *
 * - `'default'`  — platform baseline: 20px (`h-5 w-5`), Lucide's default stroke.
 * - `'prominent'`— larger, slightly heavier: 24px (`size-6`), 2.25 stroke.
 * - `'refined'`  — smaller, lighter: 16px (18px at ≥1600px), 1.75 stroke,
 *   muted colour that resolves to the item's foreground on hover/active.
 */
export type MenuIconVariant = 'default' | 'prominent' | 'refined';

export interface MenuIconProps {
  className: string;
  strokeWidth?: number;
}

/** Base positioning shared by every sidebar menu icon. */
const BASE_CLASS = 'relative z-10 shrink-0';

/**
 * Single source of truth for sidebar menu icon sizing/stroke/colour.
 *
 * `isActive` only affects the `'refined'` variant: active items inherit the
 * row's own text colour instead of the muted idle treatment.
 */
export function getMenuIconProps(
  variant: MenuIconVariant = 'default',
  isActive = false,
): MenuIconProps {
  switch (variant) {
    case 'prominent':
      return { className: cn(BASE_CLASS, 'size-6'), strokeWidth: 2.25 };
    case 'refined':
      return {
        className: cn(
          BASE_CLASS,
          'size-4 min-[1600px]:size-[18px]',
          isActive
            ? 'text-current'
            : 'text-muted-foreground group-hover:text-accent-foreground motion-safe:transition-colors',
        ),
        strokeWidth: 1.75,
      };
    default:
      return { className: cn(BASE_CLASS, 'h-5 w-5') };
  }
}
