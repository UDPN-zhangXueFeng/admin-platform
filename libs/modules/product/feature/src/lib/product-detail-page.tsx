'use client';

/**
 * ProductDetailPage — read-only 商品管理 display with edit / delete actions.
 *
 * Fetches a single product via useProductQuery. Falls back to a loading
 * skeleton and surfaces errors inline. Permission-gated actions
 * ensure buttons are hidden when the user lacks rights.
 */

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@myorg/shared/ui';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';

import {
  useProductQuery,
  useDeleteProductMutation,
} from '@myorg/modules/product/data-access';
import { ProductAvatar, ProductStatusBadge } from '@myorg/modules/product/ui';
import { PRODUCT_PERMISSIONS } from '@myorg/modules/product/util';

interface ProductDetailPageProps {
  projectId: string;
  productId: string;
}

export function ProductDetailPage({
  projectId,
  productId,
}: ProductDetailPageProps) {
  const router = useRouter();
  const t = useTranslations('modules.product');

  const {
    data: item,
    isLoading,
    isError,
  } = useProductQuery(projectId, productId);
  const deleteMutation = useDeleteProductMutation(projectId);

  const handleDelete = React.useCallback(() => {
    if (!item) return;
    if (!window.confirm(t('confirmDelete'))) return;
    deleteMutation.mutate(item.id, {
      onSuccess: () => {
        router.push(`/product`);
      },
    });
  }, [item, deleteMutation, router, t]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        {t('loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/product')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ProductAvatar name={item.name} avatar={item.avatar} />
          <div>
            <h1 className="text-xl font-semibold">{item.name}</h1>
            <p className="text-sm text-muted-foreground">{item.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGuard permission={PRODUCT_PERMISSIONS.WRITE}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
          </PermissionGuard>

          <PermissionGuard permission={PRODUCT_PERMISSIONS.DELETE}>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('confirmDeleteDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t('confirmDelete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('basicInfo')}
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">{t('status')}</dt>
              <dd>
                <ProductStatusBadge status={item.status} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">{t('role')}</dt>
              <dd className="text-sm font-medium">{item.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">
                {t('createdAt')}
              </dt>
              <dd className="text-sm">
                {new Date(item.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
