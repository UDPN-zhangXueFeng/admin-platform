import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names safely.
 *
 * Combines `clsx` (conditional / object / array class joining)
 * with `tailwind-merge` (conflict resolution for Tailwind utilities).
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-primary', 'px-4')
 * // → 'py-1 bg-primary px-4'  (px-2 is overridden by px-4)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
