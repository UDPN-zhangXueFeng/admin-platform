'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Edit, Trash2 } from 'lucide-react';

import { Button, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from '@myorg/shared/ui';
import { useToast } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import { formatCurrency } from '@myorg/shared/util-formatting';

import {
  useOrderQuery,
  useDeleteOrderMutation,
} from '@myorg/modules/order/data-access';
import { OrderStatusTag, OrderTimeline } from '@myorg/modules/order/ui';
import { getOrderTimelineEvents } from '@myorg/modules/order/util';

/**
 * Order detail page.
 *
 * Displays order information, customer details, and a lifecycle timeline.
 * Uses Tabs to organise content. All data is fetched via TanStack Query.
 */
export function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const projectId = 'ecommerce'; // In real app, from ConfigProvider
  const orderId = params?.id as string;

  const { data: order, isLoading, isError } = useOrderQuery(projectId, orderId);
  const deleteMutation = useDeleteOrderMutation(projectId);

  const handleDelete = React.useCallback(() => {
    if (!order) return;
    if (!window.confirm('确定要删除该订单吗？')) return;
    deleteMutation.mutate(order.id, {
      onSuccess: () => {
        toast.success('订单已删除');
        router.push('/zh-CN/order');
      },
      onError: () => {
        toast.error('删除失败，请重试');
      },
    });
  }, [order, deleteMutation, toast, router]);

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

  if (isError || !order) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        加载订单详情失败，请返回重试。
      </div>
    );
  }

  const timelineEvents = getOrderTimelineEvents(order);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/zh-CN/order')}
            aria-label="返回列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              订单 {order.orderNo}
            </h1>
            <p className="text-sm text-muted-foreground">
              创建于 {formatDate(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            打印
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="timeline">时间线</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Order info card */}
            <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                订单信息
              </h2>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">状态</dt>
                  <dd><OrderStatusTag status={order.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">金额</dt>
                  <dd className="text-sm font-medium">
                    {formatCurrency(
                      order.totalAmount / 100,
                      'zh-CN',
                      order.currency ?? 'CNY'
                    )}
                  </dd>
                </div>
                {order.itemCount ? (
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">商品数量</dt>
                    <dd className="text-sm">{order.itemCount} 件</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {/* Customer info card */}
            <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                客户信息
              </h2>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">姓名</dt>
                  <dd className="text-sm font-medium">{order.customer}</dd>
                </div>
                {order.customerEmail ? (
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">邮箱</dt>
                    <dd className="text-sm">{order.customerEmail}</dd>
                  </div>
                ) : null}
                {order.customerPhone ? (
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">电话</dt>
                    <dd className="text-sm">{order.customerPhone}</dd>
                  </div>
                ) : null}
                {order.shippingAddress ? (
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">地址</dt>
                    <dd className="max-w-[60%] text-right text-sm">{order.shippingAddress}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              订单生命周期
            </h2>
            <OrderTimeline
              events={timelineEvents}
              currentStatus={order.status}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
