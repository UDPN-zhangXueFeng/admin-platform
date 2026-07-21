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

jest.mock('@myorg/modules/auth/data-access', () => ({
  logoutApi: jest.fn(),
}));

jest.mock('@myorg/shared/util-i18n', () => ({}));

const { logoutAndRedirect: mockLogoutAndRedirect, useAuth: mockUseAuth } =
  jest.requireMock('@myorg/shared/util-auth') as {
    logoutAndRedirect: jest.Mock;
    useAuth: jest.Mock;
  };
const { logoutApi: mockLogoutApi } = jest.requireMock(
  '@myorg/modules/auth/data-access',
) as { logoutApi: jest.Mock };

const config: ProjectConfig = {
  project: {
    id: 'test-project',
    name: 'Test Project',
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
    mockLogoutApi.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockLogoutApi.mockClear();
    mockLogoutAndRedirect.mockClear();
  });

  it('does not end the session until the user confirms logout', async () => {
    const user = userEvent.setup();
    render(<Header config={config} />);

    await user.click(screen.getByRole('button', { name: 'Open user menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log Out' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(mockLogoutApi).not.toHaveBeenCalled();
    expect(mockLogoutAndRedirect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(mockLogoutApi).not.toHaveBeenCalled();
    expect(mockLogoutAndRedirect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Open user menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log Out' }));
    await user.click(screen.getByRole('button', { name: 'Log Out' }));

    await waitFor(() => {
      expect(mockLogoutApi).toHaveBeenCalledTimes(1);
      expect(mockLogoutAndRedirect).toHaveBeenCalledTimes(1);
    });
  });
});
