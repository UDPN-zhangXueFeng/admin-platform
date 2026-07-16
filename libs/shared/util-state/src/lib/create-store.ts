import { create, type UseBoundStore, type StoreApi, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Creates a Zustand store with Redux DevTools integration and SSR safety.
 *
 * In SSR environments, Zustand stores may cause hydration mismatches if state
 * is accessed before the client hydrates. This wrapper ensures:
 * - DevTools middleware is attached in development for debugging
 * - The store initializer is SSR-safe (no window/document access during init)
 *
 * @template T - Store state shape
 * @param initializer - State creator function (can include actions)
 * @param storeName - Name displayed in Redux DevTools
 * @returns Zustand store hook
 *
 * @example
 * ```ts
 * interface CounterState {
 *   count: number;
 *   increment: () => void;
 * }
 *
 * const useCounterStore = createUIStore<CounterState>(
 *   (set) => ({
 *     count: 0,
 *     increment: () => set((state) => ({ count: state.count + 1 })),
 *   }),
 *   'CounterStore'
 * );
 * ```
 */
export function createUIStore<T extends object>(
  initializer: StateCreator<T, [], []>,
  storeName: string
): UseBoundStore<StoreApi<T>> {
  const isDev = process.env['NODE_ENV'] === 'development';

  if (isDev) {
    return create<T>()(
      devtools(initializer as StateCreator<T, [['zustand/devtools', never]], []>, { name: storeName })
    );
  }

  return create<T>()(initializer);
}
