'use client';

/**
 * MOCK SessionGuard — no-op.
 *
 * The real admin version polls backend APIs which don't exist in mock mode.
 * This stub renders nothing so the provider nesting stays identical to admin
 * without triggering any network calls.
 */
export function SessionGuard() {
  return null;
}
