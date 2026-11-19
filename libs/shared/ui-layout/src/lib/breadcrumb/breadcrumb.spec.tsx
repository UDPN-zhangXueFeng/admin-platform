import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import type { ModuleMenuItem } from '@myorg/shared/util-config';
import { Breadcrumb } from './breadcrumb';

let mockPathname: string | null = null;
let mockOrder: ModuleMenuItem[] = [];

jest.mock('@myorg/shared/util-i18n', () => ({
  usePathname: () => mockPathname,
  Link: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >(({ children, ...props }, ref) => (
    <a ref={ref} {...props}>
      {children}
    </a>
  )),
}));

jest.mock('@myorg/shared/util-config', () => ({
  useModules: () => ({ order: mockOrder }),
}));

const menu: ModuleMenuItem[] = [
  { id: 'dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
  {
    id: 'approval-manage',
    icon: 'ListChecks',
    label: 'Approval Management',
    path: '/approval-manage',
  },
  {
    id: 'accounting',
    icon: 'Calculator',
    label: 'Accounting Management',
    children: [
      {
        id: 'chart-of-accounts',
        icon: 'BarChart3',
        label: 'Chart of Accounts',
        path: '/accounting/chart-of-accounts',
      },
    ],
  },
  {
    id: 'flat-group',
    icon: 'Layers',
    label: 'Flat Group',
    children: [
      {
        id: 'flat-child',
        icon: 'Layers',
        label: 'Flat Child',
        path: '/flat-child',
      },
    ],
  },
  {
    id: 'key-management',
    icon: 'KeyRound',
    label: 'Key Management',
    children: [
      {
        id: 'key-service-configuration',
        icon: 'Key',
        label: 'Key Service Configuration',
        path: '/key-management/key-service-configuration',
      },
      {
        id: 'managed-wallets',
        icon: 'Wallet',
        label: 'Managed Wallets',
        path: '/key-management/managed-wallets',
      },
    ],
  },
  {
    id: 'system',
    icon: 'Settings',
    label: 'System Management',
    path: '/system/user',
    children: [
      {
        id: 'user',
        icon: 'Users',
        label: 'User Management',
        path: '/system/user',
      },
    ],
  },
  {
    id: 'reserve-asset',
    icon: 'Vault',
    label: 'Reserve Asset Management',
    children: [
      {
        id: 'reserve-asset-list',
        icon: 'Layers',
        label: 'Reserve Asset List',
        path: '/pledge/reserve-asset-list',
      },
    ],
  },
  {
    id: 'documentation',
    icon: 'BookOpen',
    label: 'Documentation',
    path: '/documentation',
    children: [
      {
        id: 'api-documentation',
        icon: 'FileText',
        label: 'API Documentation',
        path: '/documentation/api-documentation',
      },
    ],
  },
  {
    id: 'transaction-flow',
    icon: 'ArrowLeftRight',
    label: 'Transaction Flow',
    path: '/transaction-flow/stablecoin',
  },
  {
    id: 'onboard',
    icon: 'Landmark',
    label: 'Bank Management',
    children: [
      {
        id: 'bank',
        icon: 'Building2',
        label: 'Onboarding Management',
        path: '/onboard/bank',
      },
    ],
  },
  {
    id: 'sys',
    icon: 'Settings',
    label: 'System Management',
    path: '/sys',
    children: [
      {
        id: 'sys-user',
        icon: 'Users',
        label: 'User Management',
        path: '/sys/user',
      },
    ],
  },
];

type Crumb = {
  text: string;
  href: string | null;
  current: boolean;
};

function getCrumbs(): Crumb[] {
  const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
  const items = Array.from(nav.querySelectorAll('ol > li')).filter(
    (item) => item.textContent?.trim().length,
  );

  // The first item is the always-present Home link.
  return items.slice(1).map((item) => {
    const link = item.querySelector('a');
    return {
      text: item.textContent?.trim() ?? '',
      href: link?.getAttribute('href') ?? null,
      current: item.querySelector('[aria-current="page"]') !== null,
    };
  });
}

beforeEach(() => {
  mockOrder = menu;
  mockPathname = null;
});

describe('Breadcrumb menu hierarchy', () => {
  it('renders the whole menu chain for a hierarchical grouped child', () => {
    mockPathname = '/accounting/chart-of-accounts';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      {
        text: 'Accounting Management',
        href: '/accounting/chart-of-accounts',
        current: false,
      },
      { text: 'Chart of Accounts', href: null, current: true },
    ]);
  });

  it('renders a nested group and its child route', () => {
    mockPathname = '/key-management/managed-wallets';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      {
        text: 'Key Management',
        href: '/key-management/key-service-configuration',
        current: false,
      },
      { text: 'Managed Wallets', href: null, current: true },
    ]);
  });

  it('appends detail route segments after the matched chain', () => {
    mockPathname = '/accounting/chart-of-accounts/view';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      {
        text: 'Accounting Management',
        href: '/accounting/chart-of-accounts',
        current: false,
      },
      {
        text: 'Chart of Accounts',
        href: '/accounting/chart-of-accounts',
        current: false,
      },
      { text: 'View', href: null, current: true },
    ]);
  });

  it('prefers the deeper chain when parent and child share a path', () => {
    mockPathname = '/system/user';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      {
        text: 'System Management',
        href: '/system/user',
        current: false,
      },
      { text: 'User Management', href: null, current: true },
    ]);
  });

  it('falls back to humanized URL segments when no menu path matches', () => {
    mockPathname = '/ui-showcase';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      { text: 'Ui Showcase', href: null, current: true },
    ]);
  });

  it('renders a single configured leaf route', () => {
    mockPathname = '/approval-manage';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      { text: 'Approval Management', href: null, current: true },
    ]);
  });
});

describe('Breadcrumb cross-app menu shapes', () => {
  it('renders a flat child whose path does not share the group prefix', () => {
    mockPathname = '/pledge/reserve-asset-list';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      {
        text: 'Reserve Asset Management',
        href: '/pledge/reserve-asset-list',
        current: false,
      },
      { text: 'Reserve Asset List', href: null, current: true },
    ]);
  });

  it('renders a flat child route that is unrelated to the group id', () => {
    mockPathname = '/flat-child';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      { text: 'Flat Group', href: '/flat-child', current: false },
      { text: 'Flat Child', href: null, current: true },
    ]);
  });

  it('renders a group with an explicit path and a deeper child path', () => {
    mockPathname = '/documentation/api-documentation';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      { text: 'Documentation', href: '/documentation', current: false },
      { text: 'API Documentation', href: null, current: true },
    ]);
  });

  it('preserves extra segments inside a selected item path', () => {
    mockPathname = '/transaction-flow/stablecoin';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      {
        text: 'Transaction Flow',
        href: '/transaction-flow/stablecoin',
        current: false,
      },
      { text: 'Stablecoin', href: null, current: true },
    ]);
  });

  it('appends detail segments after extra item path segments', () => {
    mockPathname = '/transaction-flow/stablecoin/details';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      {
        text: 'Transaction Flow',
        href: '/transaction-flow/stablecoin',
        current: false,
      },
      {
        text: 'Stablecoin',
        href: '/transaction-flow/stablecoin',
        current: false,
      },
      { text: 'Details', href: null, current: true },
    ]);
  });

  it('renders a kissen-style group with a shared URL prefix', () => {
    mockPathname = '/onboard/bank';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      { text: 'Bank Management', href: '/onboard/bank', current: false },
      { text: 'Onboarding Management', href: null, current: true },
    ]);
  });

  it('renders an lp-style synthesized system group', () => {
    mockPathname = '/sys/user';
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([
      { text: 'System Management', href: '/sys', current: false },
      { text: 'User Management', href: null, current: true },
    ]);
  });

  it('renders only Home when the pathname is empty', () => {
    mockPathname = null;
    render(<Breadcrumb />);

    expect(getCrumbs()).toEqual([]);
  });
});
