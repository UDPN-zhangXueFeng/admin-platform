/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { Stepper, type StepperStep } from './stepper';

/**
 * Why: terminal and failure states must not be presented as an in-progress
 * spinner. This protects the business meaning of the lifecycle rail while
 * allowing the component to remain independent of transaction status codes.
 */
describe('Stepper state icons', () => {
  it('renders check for completed, X for failed, and spinner for active work', () => {
    const steps: StepperStep[] = [
      { id: 'completed', label: 'Completed', status: 'current', terminal: true },
      { id: 'failed', label: 'Failed', status: 'current', tone: 'danger' },
      { id: 'processing', label: 'Processing', status: 'current' },
      { id: 'upcoming', label: 'Upcoming', status: 'upcoming' },
    ];

    const { container } = render(
      <Stepper steps={steps} ariaLabel="Transaction progress" />,
    );

    expect(container.querySelectorAll('[data-step-icon="check"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-step-icon="error"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-step-icon="loading"]')).toHaveLength(2);
    expect(screen.getAllByRole('list', { name: 'Transaction progress' })).toHaveLength(2);
  });
});
