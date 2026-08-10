'use client';

/**
 * MOCK SessionGuard — no-op.
 *
 * The real admin version polls a session API that does not exist in mock
 * mode. In lp-portal (mock mode) there is nothing to guard against, so this
 * component renders nothing and performs no work.
 */
export function SessionGuard() {
  return null;
}
