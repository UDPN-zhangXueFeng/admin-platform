/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { SearchableSelect } from './searchable-select';

const OPTIONS = [
  { value: 'pair-1', label: 'CF7/USD12 (TD3 → TD5)' },
  { value: 'pair-2', label: 'CF8/USD12 (TD3 → TD5)' },
];

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: jest.fn(),
  });
});

describe('SearchableSelect', () => {
  it('filters by option label and returns the selected value', () => {
    const onValueChange = jest.fn();
    render(
      <>
        <label htmlFor="token-pair">Token Pair</label>
        <SearchableSelect
          id="token-pair"
          value="pair-1"
          options={OPTIONS}
          onValueChange={onValueChange}
          searchPlaceholder="Search token pairs"
          emptyMessage="No matching token pairs."
        />
      </>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Token Pair' }));
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Search token pairs' }),
      {
        target: { value: 'CF8' },
      },
    );

    expect(
      screen.getByRole('option', { name: 'CF8/USD12 (TD3 → TD5)' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'CF7/USD12 (TD3 → TD5)' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('option', { name: 'CF8/USD12 (TD3 → TD5)' }),
    );

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('pair-2');
  });
});
