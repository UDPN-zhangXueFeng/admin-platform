'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Search, Plus, Trash2, Eye } from 'lucide-react';

import { DataTable, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@myorg/shared/ui';
import { useToast } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import { formatCurrency } from '@myorg/shared/util-formatting';

import {
  useOrdersQuery,
  useDeleteOrderMutation,
  useOrderUiStore,
  type Order,
  type OrderListParams,
  type OrderStatus,
} from '@myorg/modules/order/data-access';
import {
  OrderStatusTag,
  OrderSummaryCards,
} from '@myorg/modules/order/ui';
import { ORDER_STATUSES } from '@myorg/modules/order/util';

const defaultParams: OrderListParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

/**
 * Order list page.
 *
 * Combines DataTable, search, status filter, and summary cards.
 * Uses TanStack Query for server state and Zustand for UI state.
 */
export function OrderListPage() {
  const router = useRouter();
  const toast = useToast();
  const projectId = 'ecommerce'; // In real app, from ConfigProvider

  const [params, setParams] = React.useState<OrderListParams>(defaultParams);
  const { selectedOrderIds, setSelectedOrderIds, setCreateDialogOpen } =
    useOrderUiStore();

  const { data, isLoading, isError } = useOrdersQuery(projectId, params);
  const deleteMutation = useDeleteOrderMutation(projectId);

  const orders = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const handleSearch = React.useCallback(
    (term: string) => {
      setParams((prev) => ({ ...prev, page: 1, orderNo: term || undefined }));
    },
    []
  );

  const handleStatusChange = React.useCallback(
    (status: string) => {
      setParams((prev) => ({
        ...prev,
        page: 1,
        status: status === 'all' ? undefined : (status as OrderStatus),
      }));
    },
    []
  );

  const handleDelete = React.useCallback(
    (id: string) => {
      if (!window.confirm('确定要删除该订单吗？')) return;
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast.success('订单已删除');
        },
        onError: () => {
          toast.error('删除失败，请重试');
        },
      });
    },
    [deleteMutation, toast]
  );

  const columns = React.useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: 'orderNo',
        header: '订单编号',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.orderNo}</span>
        ),
      },
      {
        accessorKey: 'customer',
        header: '客户',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.customer}</span>
            {row.original.customerEmail ? (
              <span className="text-xs text-muted-foreground">
                {row.original.customerEmail}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: '金额',
        cell: ({ row }) => (
          <span className="text-sm">
            {formatCurrency(
              row.original.totalAmount / 100,
              'zh-CN',
              row.original.currency ?? 'CNY'
            )}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <OrderStatusTag status={row.original.status} />,
      },
      {
        accessorKey: 'createdAt',
        header: '创建时间',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="查看详情"
              onClick={() => router.push(`/zh-CN/order/${row.original.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="删除"
              onClick={() => handleDelete(row.original.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [router, handleDelete]
  );

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        加载订单列表失败，请刷新页面重试。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <OrderSummaryCards
        totalOrders={paginationMeta?.total ?? 0}
        totalRevenue="¥128,450.00"
        activeCustomers={342}
        pendingOrders={12}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索订单编号..."
              className="pl-8"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <Select
            value={(params.status as string) ?? 'all'}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新建订单
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        emptyMessage="暂无订单数据"
        pagination={
          paginationMeta
            ? {
                page: paginationMeta.page,
                pageSize: paginationMeta.pageSize,
                total: paginationMeta.total,
                onPageChange: (page) =>
                  setParams((prev) => ({ ...prev, page })),
              }
            : undefined
        }
        selection={
          {
            selectedIds: selectedOrderIds,
            onSelectionChange: setSelectedOrderIds,
          }
        }
      />
    </div>
  );
}
