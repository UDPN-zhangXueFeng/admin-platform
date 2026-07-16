import * as React from 'react';
import { render } from '@testing-library/react';
import { TravelRuleStatusBadge } from './travel-rule-status-badge';

/**
 * Plain-DOM assertions (no jest-dom) so the spec runs without a per-lib
 * jest-dom setup — matches the project's minimal jest config per library.
 *
 * Note: we deliberately do NOT import the shared DataTable here. Pulling the
 * `@myorg/shared/ui` barrel into a jest test drags in next-intl's ESM build
 * (via sidebar → util-i18n), which @swc/jest cannot transform from node_modules.
 * DataTable render is already covered by shared-ui's data-table-panel spec;
 * this file focuses on travel-rule's own badge.
 */
const badgeText = (container: HTMLElement): string =>
  container.querySelector('span')?.textContent ?? '';

const badgeClass = (container: HTMLElement): string =>
  container.querySelector('span')?.className ?? '';

describe('TravelRuleStatusBadge', () => {
  it('renders the status string as the default label for each status', () => {
    expect(badgeText(render(<TravelRuleStatusBadge status="Pending" />).container)).toBe('Pending');
    expect(badgeText(render(<TravelRuleStatusBadge status="Verified" />).container)).toBe('Verified');
    expect(badgeText(render(<TravelRuleStatusBadge status="Rejected" />).container)).toBe('Rejected');
  });

  it('renders a custom label so callers can localise (i18n)', () => {
    const { container } = render(<TravelRuleStatusBadge status="Pending" label="待验证" />);
    expect(badgeText(container)).toBe('待验证');
  });

  it('maps each status to its semantic colour', () => {
    expect(badgeClass(render(<TravelRuleStatusBadge status="Pending" />).container)).toContain('bg-yellow-100');
    expect(badgeClass(render(<TravelRuleStatusBadge status="Verified" />).container)).toContain('bg-green-100');
    expect(badgeClass(render(<TravelRuleStatusBadge status="Rejected" />).container)).toContain('bg-red-100');
  });

  it('forwards extra className and arbitrary attributes', () => {
    const { container } = render(
      <TravelRuleStatusBadge status="Verified" className="my-extra" data-testid="tr-badge" />
    );
    const span = container.querySelector('span');
    expect(span?.className).toContain('my-extra');
    expect(span?.getAttribute('data-testid')).toBe('tr-badge');
  });
});
