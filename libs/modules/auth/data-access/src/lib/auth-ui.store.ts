import { createUIStore } from '@myorg/shared/util-state';

/**
 * Auth UI state — tracks the login flow step and captcha data.
 *
 * This Zustand store is used by the login page and its sub-components
 * to coordinate state across the multi-step login flow.
 */

export type LoginStep = 'password' | 'twoFactor';
const TWO_FACTOR_TOKEN_KEY = 'twoFactorToken';

interface AuthUIState {
  /** Current step in the login flow */
  loginStep: LoginStep;
  /** Captcha image as a blob URL */
  captchaUrl: string;
  /** Random string from captcha response header — sent with login request */
  randomstr: string;
  /** Two-factor token — returned by password login when 2FA is enabled */
  twoFactorToken: string | null;
}

interface AuthUIActions {
  setLoginStep: (step: LoginStep) => void;
  setCaptcha: (url: string, randomstr: string) => void;
  setTwoFactorToken: (token: string | null) => void;
  reset: () => void;
}

const initialState: AuthUIState = {
  loginStep: 'password',
  captchaUrl: '',
  randomstr: '',
  twoFactorToken: null,
};

export const useAuthUIStore = createUIStore<AuthUIState & AuthUIActions>(
  (set) => ({
    ...initialState,
    setLoginStep: (step) => set({ loginStep: step }),
    setCaptcha: (url, randomstr) => set((state) => {
      if (state.captchaUrl && state.captchaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(state.captchaUrl);
      }
      return { captchaUrl: url, randomstr };
    }),
    setTwoFactorToken: (token) => {
      if (typeof window !== 'undefined') {
        if (token) {
          window.localStorage.setItem(TWO_FACTOR_TOKEN_KEY, token);
        } else {
          window.localStorage.removeItem(TWO_FACTOR_TOKEN_KEY);
        }
      }
      set({ twoFactorToken: token });
    },
    reset: () => set(initialState),
  }),
  'auth-ui'
);
