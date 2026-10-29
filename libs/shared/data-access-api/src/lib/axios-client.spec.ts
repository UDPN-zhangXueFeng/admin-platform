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
  it('redirects to login for an HTTP 401 response', async () => {
    axiosClient.defaults.adapter = async () => {
      const error = Object.assign(new Error('Unauthorized'), {
        response: { status: 401 },
      });
      throw error;
    };

    await expect(axiosClient.get('/api/manage/v1/wallets/user/list')).rejects.toThrow(
      'Unauthorized',
    );
    expect(mockedLogoutAndRedirect).toHaveBeenCalledTimes(1);
  });
});

describe('axiosClient business-code handling', () => {
  const originalAdapter = axiosClient.defaults.adapter;

  const respondWith = (data: unknown) => {
    axiosClient.defaults.adapter = async (config) =>
      ({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config as InternalAxiosRequestConfig,
      }) satisfies AxiosResponse;
  };

  afterEach(() => {
    axiosClient.defaults.adapter = originalAdapter;
  });

  it.each([0, '0'])('passes a success code %p through untouched', async (code) => {
    respondWith({ code, data: { rows: [] }, message: 'ok' });

    const response = await axiosClient.get('/api/manage/v1/wallets/user/list');

    expect(response.data).toEqual({ code, data: { rows: [] }, message: 'ok' });
  });

  it('rejects a non-zero business code and maps the MSG code to a message', async () => {
    respondWith({ code: 1, data: null, message: 'MSG_01_1016' });

    await expect(
      axiosClient.post('/api/rbac/v1/login')
    ).rejects.toMatchObject({ code: 1, message: expect.any(String) });
  });

  it('falls back to the 500-family `msg` field when `message` is absent', async () => {
    respondWith({ code: 500, data: null, msg: 'Internal Server Error' });

    await expect(axiosClient.post('/api/rbac/v1/login')).rejects.toMatchObject({
      code: 500,
      message: 'Internal Server Error',
    });
  });

  it('rejects a non-numeric business code instead of treating it as success', async () => {
    respondWith({ code: '1', data: { rows: [] }, message: 'MSG_01_1016' });

    await expect(
      axiosClient.get('/api/manage/v1/wallets/user/list')
    ).rejects.toBeInstanceOf(Error);
  });

  it('treats a missing code as success', async () => {
    respondWith({ data: { rows: [] } });

    const response = await axiosClient.get('/api/manage/v1/wallets/user/list');

    expect(response.data).toEqual({ data: { rows: [] } });
  });
});
