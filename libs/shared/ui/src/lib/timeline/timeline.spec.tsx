/** @jest-environment jsdom */
import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import { Timeline } from './timeline';

describe('Timeline', () => {
  it('renders accessible steps and connectors', () => {
    const { container } = render(
      <Timeline ariaLabel="Workflow Log" items={[
        { title: 'Created', status: 'complete' },
        { title: 'Review', status: 'current' },
        { title: 'Done', status: 'upcoming' },
      ]} />,
    );
    const list = screen.getByRole('list', { name: 'Workflow Log' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(container.querySelectorAll('[data-timeline-node="complete"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-timeline-node="current"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-timeline-node="upcoming"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(container.querySelectorAll('[data-timeline-connector]')).toHaveLength(2);
    expect(items[2].querySelector('[data-timeline-connector]')).toBeNull();
  });
});
