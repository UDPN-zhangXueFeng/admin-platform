import * as React from 'react';

import { cn } from '@myorg/shared/util-classnames';

/**
 * Skeleton — shimmering placeholder for loading states.
 * Standard shadcn/ui pattern: `animate-pulse rounded-md bg-muted`.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
