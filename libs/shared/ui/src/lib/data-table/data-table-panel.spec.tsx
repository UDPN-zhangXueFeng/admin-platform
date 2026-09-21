import * as React from 'react';
import { render, screen } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTablePanel } from './data-table-panel';

interface TestRow {
  id: string;
  name: string;
}

const columns: ColumnDef<TestRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.original.name,
  },
];

describe('DataTablePanel', () => {
  it('renders the title, extra content, filter slot, and table data together', () => {
    render(
      <DataTablePanel
        title="Users"
        extra={<button type="button">Create</button>}
        filter={<label htmlFor="keyword">Keyword</label>}
        columns={columns}
        data={[{ id: 'user-1', name: 'Ada Lovelace' }]}
      />
    );

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByText('Keyword')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('shows loading rows before an empty message so pending requests are visible', () => {
    render(
      <DataTablePanel
        columns={columns}
        data={[]}
        isLoading
        emptyMessage="No users found"
      />
    );

    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
    expect(document.querySelectorAll("[class*='animate-pulse']")).toHaveLength(5);
  });

  it('renders the configured empty message when loading has finished with no rows', () => {
    render(
      <DataTablePanel
        columns={columns}
        data={[]}
        emptyMessage="No users found"
      />
    );

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('keeps API failures visible without hiding existing rows', () => {
    render(
      <DataTablePanel
        columns={columns}
        data={[{ id: 'user-1', name: 'Ada Lovelace' }]}
        error="Unable to refresh users"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to refresh users');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});
