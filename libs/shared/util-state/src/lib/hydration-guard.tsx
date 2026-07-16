'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks whether the component has mounted on the client.
 *
 * This is essential for avoiding React hydration mismatches when rendering
 * client-only state (e.g., localStorage values, window dimensions, user
 * preferences) in SSR/SSG environments like Next.js.
 *
 * Use this hook to conditionally render client-dependent UI or to gate
 * client-only logic until after hydration completes.
 *
 * @returns `true` if the component has mounted on the client, `false` during SSR and initial hydration
 *
 * @example
 * ```tsx
 * function UserGreeting() {
 *   const isHydrated = useHydration();
 *
 *   if (!isHydrated) {
 *     return <Skeleton />;
 *   }
 *
 *   return <span>Welcome back!</span>;
 * }
 * ```
 */
export function useHydration(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}
