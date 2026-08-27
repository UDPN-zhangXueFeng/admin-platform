import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { Header } from './header';

jest.mock('@myorg/shared/util-auth', () => ({
  logoutAndRedirect: jest.fn(),
  useAuth: jest.fn(),
}));

jest.mock('@myorg/shared/util-i18n', () => ({}));

const { logoutAndRedirect: mockLogoutAndRedirect, useAuth: mockUseAuth } =
  jest.requireMock('@myorg/shared/util-auth') as {
    logoutAndRedirect: jest.Mock;
    useAuth: jest.Mock;
  };

const config: ProjectConfig = {
  project: {
    id: 'test-project',
    name: 'Test Project',
    subtitle: 'Stablecoin Management System',
    logo: '',
    favicon: '',
  },
  theme: {
    mode: 'light',
    colors: {},
    radius: '0.5rem',
    fontFamily: { sans: 'sans-serif', mono: 'monospace' },
  },
  layout: {
    type: 'sidebar',
    sidebar: {
      position: 'left',
      width: '240px',
      collapsible: true,
      collapsedWidth: '64px',
      showIconsOnlyCollapsed: true,
    },
    header: {
      sticky: false,
      showProjectSwitcher: false,
      showSearch: false,
      showNotifications: true,
      showUserMenu: true,
    },
    breadcrumb: { enabled: true },
  },
  modules: { enabled: [], order: [], dashboard: { widgets: [] } },
  i18n: { defaultLocale: 'en-US', locales: ['en-US'], projectOverrides: {} },
  features: {
    darkMode: false,
    multiTab: false,
    fullscreen: false,
    exportCSV: false,
    bulkActions: false,
    inactivityLogout: false,
  },
};

describe('Header logout confirmation', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { name: 'Cui Ning' } });
  });

  afterEach(() => {
    mockLogoutAndRedirect.mockClear();
  });

  it('does not end the session until the user confirms logout', async () => {
    const user = userEvent.setup();
    render(<Header config={config} />);

    await user.click(screen.getByRole('button', { name: 'Open user menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log Out' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(mockLogoutAndRedirect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(mockLogoutAndRedirect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Open user menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log Out' }));
    await user.click(screen.getByRole('button', { name: 'Log Out' }));

    // 确认前两次打开/取消均不得触发；确认后默认平台流程恰好一次。
    await waitFor(() => {
      expect(mockLogoutAndRedirect).toHaveBeenCalledTimes(1);
    });
  });

  it('delegates the whole flow to onLogout when the project provides it', async () => {
    const user = userEvent.setup();
    const onLogout = jest.fn().mockResolvedValue(undefined);
    render(<Header config={config} onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: 'Open user menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log Out' }));
    await user.click(screen.getByRole('button', { name: 'Log Out' }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledTimes(1);
    });
    // 项目接管时不得再走平台默认登出（否则重复清理/跳转）。
    expect(mockLogoutAndRedirect).not.toHaveBeenCalled();
  });
});
