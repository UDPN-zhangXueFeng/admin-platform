/**
 * MOCK Session Guard — no-op.
 *
 * The real admin version polls the backend for session validity. Mock mode
 * has no backend, so this renders nothing and performs no checks.
 */
'use client';

export function SessionGuard() {
  return null;
}
