import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import { axiosClient } from './axios-client';

jest.mock('@myorg/shared/util-auth', () => ({
  getAccessToken: jest.fn(() => 'active-token'),
  logoutAndRedirect: jest.fn(),
}));

const mockedLogoutAndRedirect = jest.mocked(logoutAndRedirect);

describe('axiosClient session expiry handling', () => {
  const originalAdapter = axiosClient.defaults.adapter;

  afterEach(() => {
    axiosClient.defaults.adapter = originalAdapter;
    mockedLogoutAndRedirect.mockClear();
  });

  it.each([3, 4, '3', '4'])('redirects to login for expired-session code %p', async (code) => {
    axiosClient.defaults.adapter = async (config) =>
      ({
        data: { code, data: null, message: 'Session expired' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config as InternalAxiosRequestConfig,
      }) satisfies AxiosResponse;

    await expect(axiosClient.get('/api/rbac/v1/user/listPage')).rejects.toThrow(
      'Session expired'
    );
    expect(mockedLogoutAndRedirect).toHaveBeenCalledTimes(1);
  });
});
