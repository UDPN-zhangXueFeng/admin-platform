import { AxiosError } from 'axios';
import type { ApiError as ApiErrorShape } from '@myorg/shared/model';

export { type ApiErrorShape };

/**
 * Standardised API error class.
 *
 * Wraps HTTP status, business error code, message, and optional
 * field-level validation errors into a single throwable object.
 */
export class ApiError extends Error implements ApiErrorShape {
  status: number;
  code: number;
  override message: string;
  errors?: Record<string, string[]>;

  constructor({ status, code, message, errors }: ApiErrorShape) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
    this.errors = errors;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Normalises an Axios error into a consistent {@link ApiError}.
 *
 * - If the server responded with an error payload, extracts `code`, `message`,
 *   and `errors` from the response body.
 * - For network errors or timeouts, synthesises a user-friendly message.
 * - Falls back to a generic message for unexpected failures.
 */
export function normalizeApiError(error: AxiosError<unknown>): ApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data;

  // Server returned a structured error payload
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as Record<string, unknown>).message === 'string'
  ) {
    const payload = data as Record<string, unknown>;
    return new ApiError({
      status,
      code: typeof payload.code === 'number' ? payload.code : status,
      message: payload.message as string,
      errors:
        typeof payload.errors === 'object' && payload.errors !== null
          ? (payload.errors as Record<string, string[]>)
          : undefined,
    });
  }

  // Network / timeout / no response
  if (!error.response) {
    const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    return new ApiError({
      status: 0,
      code: 0,
      message: isTimeout
        ? 'Request timed out. Please try again.'
        : 'Network error. Please check your connection.',
    });
  }

  // Fallback for unexpected response shapes
  return new ApiError({
    status,
    code: status,
    message: error.message || 'An unexpected error occurred.',
  });
}
