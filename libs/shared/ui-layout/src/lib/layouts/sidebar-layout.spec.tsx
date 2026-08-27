import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { SidebarLayout } from './sidebar-layout';

jest.mock('@myorg/shared/util-auth', () => ({
  logoutAndRedirect: jest.fn(),
  useAuth: jest.fn().mockReturnValue({ user: null }),
}));

jest.mock('@myorg/shared/util-i18n', () => ({
  usePathname: () => null,
}));

jest.mock('@myorg/shared/util-config', () => ({
  useModules: () => ({ order: [] }),
}));

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
    breadcrumb: { enabled: false },
  },
  modules: {
    enabled: [],
    order: [
      {
        id: 'system',
        icon: 'Shield',
        label: 'System Management',
        path: '/system/user',
        group: '',
        children: [
          {
            id: 'user',
            icon: 'Users',
            label: 'User Management',
            path: '/system/user',
          },
        ],
      },
    ],
    dashboard: { widgets: [] },
  },
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

const TEST_KEY = 'test.nav.collapsed';

function renderLayout(props: Partial<Parameters<typeof SidebarLayout>[0]> = {}) {
  return render(
    <SidebarLayout config={config} {...props}>
      <div>content</div>
    </SidebarLayout>,
  );
}

describe('SidebarLayout collapsed-state persistence (opt-in persistKey)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays session-only when no persistKey is given (platform default)', async () => {
    const user = userEvent.setup();
    renderLayout();

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapse).toHaveAttribute('aria-pressed', 'false');

    await user.click(collapse);

    // Toggle works, but nothing may leak into storage — other apps (admin)
    // must keep their current session-only behavior.
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.length).toBe(0);
  });

  it("writes '1'/'0' to the persistKey on toggle", async () => {
    const user = userEvent.setup();
    renderLayout({ persistKey: TEST_KEY });

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem(TEST_KEY)).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(localStorage.getItem(TEST_KEY)).toBe('0');
  });

  it("restores the collapsed state when the key already holds '1'", () => {
    localStorage.setItem(TEST_KEY, '1');
    renderLayout({ persistKey: TEST_KEY });

    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it("treats any value other than '1' as expanded", () => {
    localStorage.setItem(TEST_KEY, '0');
    renderLayout({ persistKey: TEST_KEY });

    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('SidebarLayout width override (opt-in sidebarWidths)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps the platform default widths when not provided', () => {
    renderLayout();
    expect(screen.getByLabelText('Main navigation')).toHaveClass('w-60');
  });

  it('applies the provided width classes and persists the toggle', async () => {
    const user = userEvent.setup();
    renderLayout({
      persistKey: TEST_KEY,
      sidebarWidths: {
        expanded: 'w-[224px] min-[1600px]:w-[224px]',
        collapsed: 'w-[68px] min-[1600px]:w-[68px]',
      },
    });

    const aside = screen.getByLabelText('Main navigation');
    expect(aside).toHaveClass('w-[224px]');

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByLabelText('Main navigation')).toHaveClass('w-[68px]');
    expect(localStorage.getItem(TEST_KEY)).toBe('1');
  });
});

describe('SidebarLayout header opt-in props', () => {
  it('renders a static brand block by default', () => {
    renderLayout();
    expect(
      screen.queryByRole('button', { name: 'Back to portal home' }),
    ).not.toBeInTheDocument();
  });

  it('invokes onBrandClick when the brand button is clicked', async () => {
    const user = userEvent.setup();
    const onBrandClick = jest.fn();
    renderLayout({ onBrandClick });

    await user.click(
      screen.getByRole('button', { name: 'Back to portal home' }),
    );
    expect(onBrandClick).toHaveBeenCalledTimes(1);
  });

  it('hides the Manage Account entry when hideManageAccount is set', async () => {
    const user = userEvent.setup();
    renderLayout({ hideManageAccount: true });

    await user.click(screen.getByRole('button', { name: 'Open user menu' }));

    expect(screen.queryByText('Manage Account')).not.toBeInTheDocument();
    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });

  it('keeps the Manage Account entry by default', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open user menu' }));

    expect(screen.getByText('Manage Account')).toBeInTheDocument();
  });
});
