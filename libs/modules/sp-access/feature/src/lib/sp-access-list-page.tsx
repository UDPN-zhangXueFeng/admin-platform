'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { Button, Input } from '@myorg/shared/ui';
import { DataTable } from '@myorg/shared/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  useSpAccessListQuery,
  useSpAccessStablecoinOptionsQuery,
  type SpAccessRecord,
} from '@myorg/modules/sp-access/data-access';
import { formatServiceProviderTypeLabel, formatSpAccessStatusLabel } from '@myorg/modules/sp-access/util';

const ALL_STABLECOINS_VALUE = 'all-stablecoins';
const ALL_STATUS_VALUE = 'all-statuses';

function formatTimestamp(value?: number): string {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}

function isEditableStatus(status: number): boolean {
  return status === 1 || status === 2;
}

export function SpAccessListPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [serviceProviderName, setServiceProviderName] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [stablecoinName, setStablecoinName] = React.useState('');

  const { data: stablecoinOptions } = useSpAccessStablecoinOptionsQuery();

  const { data, isLoading } = useSpAccessListQuery({
    pageNum: page,
    pageSize: 10,
    filters: {
      serviceProviderName: serviceProviderName || undefined,
      status: status ? Number(status) : undefined,
      stablecoinName: stablecoinName || undefined,
    },
  });

  const columns = React.useMemo<ColumnDef<SpAccessRecord>[]>(
    () => [
      {
        accessorKey: 'serviceProviderName',
        header: 'Service Provider Name',
      },
      {
        accessorKey: 'spCode',
        header: 'SP Code',
      },
      {
        accessorKey: 'serviceProviderType',
        header: 'Access Type',
        cell: ({ getValue }) => formatServiceProviderTypeLabel(getValue() as string),
      },
      {
        accessorKey: 'stablecoinName',
        header: 'Stablecoin',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => formatSpAccessStatusLabel(getValue() as number),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated At',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!isEditableStatus(record.status)}
                onClick={() =>
                  router.push(
                    `/sp-access/edit?id=${record.spRecordId}&spId=${record.spId ?? ''}&spCode=${record.spCode}`,
                  )
                }
              >
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  router.push(
                    `/sp-access/detail?id=${record.spRecordId}&spId=${record.spId ?? ''}&spCode=${record.spCode}`,
                  )
                }
              >
                View
              </Button>
            </div>
          );
        },
      },
    ],
    [router]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium">Keyword</label>
          <Input
            value={serviceProviderName}
            onChange={(event) => {
              setServiceProviderName(event.target.value);
              setPage(1);
            }}
            placeholder="Search service provider"
          />
        </div>
        <div className="w-full md:w-52">
          <label className="mb-1.5 block text-sm font-medium">Stablecoin</label>
          <Select
            value={stablecoinName || ALL_STABLECOINS_VALUE}
            onValueChange={(value) => {
              setStablecoinName(value === ALL_STABLECOINS_VALUE ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All stablecoins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STABLECOINS_VALUE}>All stablecoins</SelectItem>
              {(stablecoinOptions ?? []).map((option) => (
                <SelectItem
                  key={option.stablecoinCode ?? option.name}
                  value={option.name}
                >
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS_VALUE}>All statuses</SelectItem>
              <SelectItem value="0">Opening</SelectItem>
              <SelectItem value="1">Enabled</SelectItem>
              <SelectItem value="2">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => router.push('/sp-access/create')}>Register</Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No service providers found."
        pagination={{
          page,
          pageSize: data?.pageSize ?? 10,
          total: data?.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
