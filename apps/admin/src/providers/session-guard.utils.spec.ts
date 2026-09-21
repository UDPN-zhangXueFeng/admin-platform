import {
  hasExceededInactivityTimeout,
  INACTIVITY_TIMEOUT_MS,
  isInactivityLogoutEnabled,
} from './session-guard.utils';

describe('SessionGuard inactivity policy', () => {
  it('never enables inactivity logout during development', () => {
    expect(isInactivityLogoutEnabled(true, 'development')).toBe(false);
  });

  it('requires an explicit production config opt-in', () => {
    expect(isInactivityLogoutEnabled(false, 'production')).toBe(false);
    expect(isInactivityLogoutEnabled(true, 'production')).toBe(true);
  });

  it('expires only after the full 30-minute inactivity window', () => {
    const lastActivityAt = 1_000;

    expect(
      hasExceededInactivityTimeout(
        lastActivityAt,
        lastActivityAt + INACTIVITY_TIMEOUT_MS - 1,
      ),
    ).toBe(false);
    expect(
      hasExceededInactivityTimeout(
        lastActivityAt,
        lastActivityAt + INACTIVITY_TIMEOUT_MS,
      ),
    ).toBe(true);
  });
});
