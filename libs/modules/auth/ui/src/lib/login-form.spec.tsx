import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@myorg/shared/util-i18n', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('@myorg/modules/auth/data-access', () => {
  const setCaptcha = jest.fn();

  return {
    getCaptcha: jest.fn(),
    useLoginMutation: () => ({
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
    }),
    useAuthUIStore: () => ({
      captchaUrl: '',
      randomstr: '',
      setCaptcha,
      setTwoFactorToken: jest.fn(),
      setLoginStep: jest.fn(),
    }),
  };
});

import { LoginForm } from './login-form';

const authDataAccessMock = jest.requireMock(
  '@myorg/modules/auth/data-access'
) as {
  getCaptcha: jest.Mock;
  useAuthUIStore: () => { setCaptcha: jest.Mock };
};
const mockGetCaptcha = authDataAccessMock.getCaptcha;
const mockSetCaptcha = authDataAccessMock.useAuthUIStore().setCaptcha;

const captchaResponse = (randomstr: string) => ({
  data: new Blob(['captcha']),
  headers: { randomstr },
});

describe('LoginForm captcha refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetCaptcha.mockReset();
    mockSetCaptcha.mockReset();
    mockGetCaptcha.mockResolvedValue(captchaResponse('first') as never);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:captcha'),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL');
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('refreshes the captcha after 15 minutes and clears the invalid prior code', async () => {
    const { unmount } = render(<LoginForm />);

    await waitFor(() => expect(mockGetCaptcha).toHaveBeenCalledTimes(1));

    const codeInput = screen.getByPlaceholderText('captchaPlaceholder');
    fireEvent.change(codeInput, { target: { value: 'stale-code' } });
    expect(codeInput).toHaveValue('stale-code');

    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000 - 1);
    });
    expect(mockGetCaptcha).toHaveBeenCalledTimes(1);

    mockGetCaptcha.mockResolvedValueOnce(captchaResponse('second') as never);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => expect(mockGetCaptcha).toHaveBeenCalledTimes(2));
    expect(codeInput).toHaveValue('');
    expect(mockSetCaptcha).toHaveBeenLastCalledWith('blob:captcha', 'second');

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(mockGetCaptcha).toHaveBeenCalledTimes(2);
  });
});
