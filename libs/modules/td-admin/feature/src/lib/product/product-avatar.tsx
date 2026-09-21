'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@myorg/shared/util-classnames';

export interface ProductAvatarProps {
  name: string;
  avatar?: string | null;
  className?: string;
}

/**
 * 商品管理 avatar with fallback initials.
 *
 * Uses Radix Avatar for robust image-loading and fallback behaviour.
 */
export function ProductAvatar({ name, avatar, className }: ProductAvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className,
      )}
    >
      <AvatarPrimitive.Image
        src={avatar ?? undefined}
        alt={name}
        className="aspect-square h-full w-full"
      />
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
