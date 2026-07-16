'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  type KeyServiceConfiguration,
  useKeyServiceConfigurationsQuery,
} from '@myorg/modules/key-management/data-access';

const ALL_STATUS_VALUE = 'all-statuses';
const PAGE_SIZE = 10;

const STATUS_LABELS: Record<number, string> = {
  1: 'Enabled',
  2: 'Deprecated',
  3: 'Processing',
  4: 'Rejected',
};

function formatTimestamp(value?: number): string {
  return value ? new Date(value).toLocaleString() : '--';
}

function formatSupportedChains(value?: string): string {
  return (
    value
      ?.split(',')
      .map((chain) => chain.trim())
      .filter(Boolean)
      .join(', ') || '--'
  );
}

/** Key Service Configuration landing page migrated from td-manage. */
export function KeyServiceConfigurationListPage() {
  const [page, setPage] = React.useState(1);
  const [keyServiceName, setKeyServiceName] = React.useState('');
  const [status, setStatus] = React.useState('');

  const { data, isLoading, isFetching } = useKeyServiceConfigurationsQuery({
    pageNum: page,
    pageSize: PAGE_SIZE,
    filters: {
      keyServiceName: keyServiceName || undefined,
      status: status ? Number(status) : undefined,
    },
  });

  const columns = React.useMemo<ColumnDef<KeyServiceConfiguration>[]>(
    () => [
      {
        accessorKey: 'keyServiceName',
        header: 'Key Service Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'url',
        header: 'URL',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'supportedChains',
        header: 'Supported Chains',
        cell: ({ getValue }) => formatSupportedChains(getValue() as string),
      },
      {
        accessorKey: 'createdOn',
        header: 'Created On',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'lastUpdated',
        header: 'Last Updated',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => STATUS_LABELS[getValue() as number] ?? '--',
      },
    ],
    [],
  );

  const handleReset = () => {
    setKeyServiceName('');
    setStatus('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label
            className="mb-1.5 block text-sm font-medium"
            htmlFor="key-service-name"
          >
            Key Service Name
          </label>
          <Input
            id="key-service-name"
            value={keyServiceName}
            onChange={(event) => {
              setKeyServiceName(event.target.value);
              setPage(1);
            }}
            placeholder="Search key service"
          />
        </div>
        <div className="w-full md:w-52">
          <label className="mb-1.5 block text-sm font-medium">Status</label>
          <Select
            value={status || ALL_STATUS_VALUE}
            onValueChange={(value) => {
              setStatus(value === ALL_STATUS_VALUE ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS_VALUE}>All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-4 text-lg font-semibold">
          Key Service Configuration
        </h2>
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          isLoading={isLoading || isFetching}
          emptyMessage="No key services found."
          pagination={{
            page,
            pageSize: data?.page?.pageSize ?? PAGE_SIZE,
            total: data?.page?.total ?? 0,
            onPageChange: setPage,
          }}
        />
      </div>
    </div>
  );
}
