/**
 * Sensitive access-parameter handling for key-service-configuration.
 *
 * Main-agent security directive: credential-like parameter values (private
 * keys, passwords, tokens, secrets, API keys) must render masked by default
 * with an explicit per-value reveal toggle, and must never be logged.
 * Detection is key-based — the backend wire does not mark sensitivity.
 */

/** Display placeholder for a masked sensitive value (fixed length — no leak). */
export const MASKED_VALUE = '••••••••';

/**
 * Keys treated as sensitive. Matched case-insensitively against the
 * parameter key (e.g. `Authorization`, `privateKey`, `X-API-Key`).
 * Conservative list to limit false positives.
 */
const SENSITIVE_KEY_PATTERN =
  /private|password|pwd|secret|token|api[-_]?key|credential|authorization|mnemonic/i;

/** Whether an access-parameter row's value must be masked by default. */
export function isSensitiveParameterKey(parameterKey?: string): boolean {
  if (!parameterKey) return false;
  return SENSITIVE_KEY_PATTERN.test(parameterKey);
}
