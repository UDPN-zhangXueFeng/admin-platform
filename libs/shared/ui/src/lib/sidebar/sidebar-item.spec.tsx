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
  Link: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
    ({ children, ...props }, ref) => (
      <a ref={ref} {...props}>
        {children}
      </a>
    ),
  ),
}));

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
});
