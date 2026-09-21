import { axiosClient } from './axios-client';
import type { ApiRequestConfig } from './axios-client';
import type { ApiResponse } from '@myorg/shared/model';
import { ApiError } from './api-error';

export type { ApiRequestConfig };

function unwrapResponseData<T>(response: ApiResponse<T>, url: string): T {
  if (response.data === undefined) {
    throw new ApiError({
      status: 200,
      code: response.code,
      message: response.message || `API response data is undefined for ${url}.`,
    });
  }

  return response.data;
}

/**
 * Type-safe HTTP client wrapper.
 *
 * All methods unwrap the standard {@link ApiResponse} envelope and return
 * the inner `data` field directly. Errors are guaranteed to be normalised
 * to {@link ApiError} by the Axios response interceptor.
 */
export const apiClient = {
  async get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    const response = await axiosClient.get<ApiResponse<T>>(url, config);
    return unwrapResponseData(response.data, url);
  },

  async post<T, D = unknown>(
    url: string,
    data?: D,
    config?: ApiRequestConfig
  ): Promise<T> {
    const response = await axiosClient.post<ApiResponse<T>>(url, data, config);
    return unwrapResponseData(response.data, url);
  },

  async patch<T, D = unknown>(
    url: string,
    data?: D,
    config?: ApiRequestConfig
  ): Promise<T> {
    const response = await axiosClient.patch<ApiResponse<T>>(url, data, config);
    return unwrapResponseData(response.data, url);
  },

  async delete<T = void>(url: string, config?: ApiRequestConfig): Promise<T> {
    const response = await axiosClient.delete<ApiResponse<T>>(url, config);
    return unwrapResponseData(response.data, url);
  },
};
