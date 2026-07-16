'use client';

/**
 * ProductListPage — paginated 商品管理 list with search, filters, and bulk selection.
 *
 * Architecture:
 * - Server-state (list data)    → TanStack Query via useProductsQuery
 * - Client-state (filters)      → Zustand via useProductUiStore
 * - Table rendering             → shared DataTable
 * - Permission-gated actions    → PermissionGuard / usePermission
 */

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Filter, Trash2 } from 'lucide-react';

import { Button } from '@myorg/shared/ui';
import { DataTable, DataTablePagination } from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';

import {
  useProductsQuery,
  useDeleteProductMutation,
  useProductUiStore,
  type Product,
  type ProductListParams,
} from '@myorg/modules/product/data-access';

import {
  ProductAvatar,
  ProductStatusBadge,
  ProductRoleSelector,
} from '@myorg/modules/product/ui';

import { PRODUCT_PERMISSIONS } from '@myorg/modules/product/util';

const defaultParams: ProductListParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export function ProductListPage() {
  const router = useRouter();
  const t = useTranslations('modules.product');
  const projectId = 'default'; // In real app, from ConfigProvider

  const [params, setParams] = React.useState<ProductListParams>(defaultParams);
  const { selectedProductIds, setSelectedProductIds, setCreateDialogOpen } =
    useProductUiStore();

  const { data, isLoading, isError } = useProductsQuery(projectId, params);
  const deleteMutation = useDeleteProductMutation(projectId);

  const items = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const handleSearch = React.useCallback((term: string) => {
    setParams((prev) => ({ ...prev, page: 1, search: term || undefined }));
  }, []);

  const handleDelete = React.useCallback(
    (id: string) => {
      if (!window.confirm(t('confirmDelete'))) return;
      deleteMutation.mutate(id);
    },
    [deleteMutation, t],
  );

  const columns = React.useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <ProductAvatar
              name={row.original.name}
              avatar={row.original.avatar}
            />
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: t('email'),
      },
      {
        accessorKey: 'role',
        header: t('role'),
      },
      {
        accessorKey: 'status',
        header: t('status'),
        cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createdAt',
        header: t('createdAt'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('actions'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/product/${row.original.id}`)}
            >
              {t('view')}
            </Button>
            <PermissionGuard permission={PRODUCT_PERMISSIONS.DELETE}>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleDelete(row.original.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {t('delete')}
              </Button>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [router, handleDelete, t],
  );

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        {t('loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder={t('searchPlaceholder')}
              className="h-10 rounded-md border border-input bg-background pl-8 pr-3 text-sm"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <PermissionGuard permission={PRODUCT_PERMISSIONS.WRITE}>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('create')}
          </Button>
        </PermissionGuard>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyMessage={t('empty')}
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
        selection={{
          selectedIds: selectedProductIds,
          onSelectionChange: setSelectedProductIds,
        }}
      />
    </div>
  );
}
