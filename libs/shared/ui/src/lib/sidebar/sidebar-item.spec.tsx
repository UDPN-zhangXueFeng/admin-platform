/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { usePathname } from '@myorg/shared/util-i18n';
import { SidebarItem } from './sidebar-item';

jest.mock('@myorg/shared/util-i18n', () => ({
  usePathname: jest.fn(() => '/lp/onboard'),
}));

jest.mock('next/link', () =>
  React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
    ({ children, ...props }, ref) => (
      <a ref={ref} {...props}>
        {children}
      </a>
    ),
  ),
);

describe('SidebarItem nested active state', () => {
  it('shows a light theme-primary background so the selected child is obvious', () => {
    render(
      <SidebarItem
        id="onboard"
        icon={Circle}
        label="LP Onboarding"
        path="/lp/onboard"
        collapsed={false}
        nested
      />,
    );

    expect(screen.getByRole('link', { name: 'LP Onboarding' })).toHaveClass(
      'bg-primary/10',
      'text-primary',
      'hover:bg-primary/10',
    );
  });

  it('uses a subtler theme-primary hover background for unselected children', () => {
    jest.mocked(usePathname).mockReturnValue('/lp/pools');

    render(
      <SidebarItem
        id="onboard"
        icon={Circle}
        label="LP Onboarding"
        path="/lp/onboard"
        collapsed={false}
        nested
      />,
    );

    expect(screen.getByRole('link', { name: 'LP Onboarding' })).toHaveClass(
      'hover:bg-primary/5',
    );
    expect(screen.getByRole('link', { name: 'LP Onboarding' })).not.toHaveClass(
      'bg-primary/10',
    );
  });

  it('uses 24px icons with a 2.25 stroke only when enabled', () => {
    const { rerender } = render(
      <SidebarItem
        id="onboard"
        icon={Circle}
        label="LP Onboarding"
        path="/lp/onboard"
        collapsed={false}
      />,
    );

    const icon = screen
      .getByRole('link', { name: 'LP Onboarding' })
      .querySelector('svg');
    expect(icon).toHaveClass('h-5', 'w-5');
    expect(icon).toHaveAttribute('stroke-width', '2');

    rerender(
      <SidebarItem
        id="onboard"
        icon={Circle}
        label="LP Onboarding"
        path="/lp/onboard"
        collapsed={false}
        prominentMenuIcons
      />,
    );

    const prominentIcon = screen
      .getByRole('link', { name: 'LP Onboarding' })
      .querySelector('svg');
    expect(prominentIcon).toHaveClass('size-6');
    expect(prominentIcon).toHaveAttribute('stroke-width', '2.25');
  });
});
