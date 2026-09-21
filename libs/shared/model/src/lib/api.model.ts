/**
 * Generic API response wrappers.
 *
 * The backend is expected to return responses in a consistent envelope:
 *
 * Success: { code: 0, data: T, message: "ok" }
 * Error:   { code: <non-zero>, data: null, message: "error description" }
 */

/** Standard success envelope */
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  code: number;
  data: T[];
  message: string;
  pagination: import('./pagination.model').PaginationMeta;
}

/** Normalised error shape — converted from raw AxiosError by data-access-api */
export interface ApiError {
  /** HTTP status code */
  status: number;
  /** Business error code from the backend (non-zero = error) */
  code: number;
  /** Human-readable error message (already localised by backend or fallback) */
  message: string;
  /** Optional field-level validation errors */
  errors?: Record<string, string[]>;
}
