/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import {
  render,
  screen,
  act,
  fireEvent,
} from '@testing-library/react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';

// Radix Popper (used by the tooltip arrow) observes size; jsdom lacks it.
class ResizeObserverStub {
  observe() { /* noop: jsdom has no layout engine to observe */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}
global.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver;

interface Row {
  id: string;
  longText: string;
  shortText: string;
}

const rows: Row[] = [
  { id: '1', longText: 'KSN-35ee51941eb544a3a950df1cf98dfa58', shortText: 'USD' },
];

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: 'longText',
    header: 'Long Text',
    cell: ({ row }) => <span>{row.original.longText}</span>,
  },
  {
    id: 'shortText',
    header: 'Short Text',
    cell: ({ row }) => <span>{row.original.shortText}</span>,
  },
];

/**
 * Why: the truncated-cell tooltip is the core of requirement "ellipsis + hover
 * tooltip". jsdom does no layout, so scrollWidth is monkey-patched per element
 * via a marker: only elements containing 'KSN-' report an overflow. The test
 * must fail if the tooltip opens on non-overflowing cells or never opens.
 */
describe('DataTable cell ellipsis tooltip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    const desc = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollWidth',
    );
    jest
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (this.textContent?.includes('KSN-')) return 286;
        return 100;
      });
    jest
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(() => 240);
    return () => desc && Object.defineProperty(HTMLElement.prototype, 'scrollWidth', desc);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('opens the full-content tooltip only on overflowing cells', () => {
    render(<DataTable columns={columns} data={rows} />);

    const cell = (text: string) =>
      screen.getByText(text).closest('div.truncate') as HTMLElement;
    const overflowing = cell('KSN-35ee51941eb544a3a950df1cf98dfa58');
    const short = cell('USD');

    fireEvent.pointerEnter(overflowing);
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('KSN-35ee');

    // non-overflowing cell must NOT open a tooltip

    fireEvent.pointerEnter(short);
    act(() => {
      jest.advanceTimersByTime(400);
    });
    // still exactly the one tooltip from the overflowing cell — none added for the short cell
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });
});
