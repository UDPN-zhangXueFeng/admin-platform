/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

describe('Select theme-aware option highlight', () => {
  it('tints the active option from the current theme primary color', () => {
    render(
      <Select open value="all">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole('option', { name: 'All' })).toHaveClass(
      'focus:bg-[color:color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--background)))]',
    );
  });
});
