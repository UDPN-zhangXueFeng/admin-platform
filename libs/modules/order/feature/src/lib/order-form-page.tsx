'use client';

/**
 * OrderFormPage — create / edit order form.
 *
 * Uses react-hook-form for state management. On submit calls the
 * appropriate TanStack Query mutation. Works for both create (no orderId)
 * and edit (orderId present) modes.
 */

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';

import {
  useOrderQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
} from '@myorg/modules/order/data-access';
import type { CreateOrderDTO, UpdateOrderDTO } from '@myorg/modules/order/data-access';

interface OrderFormValues {
  customer: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  totalAmount: string;
  currency: string;
  status: string;
}

export function OrderFormPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = (params?.id as string) || undefined;
  const isEdit = Boolean(orderId);
  const projectId = 'ecommerce'; // In real app, from ConfigProvider

  const { data: existingOrder } = useOrderQuery(projectId, orderId ?? '');

  const createMutation = useCreateOrderMutation(projectId);
  const updateMutation = useUpdateOrderMutation(projectId, orderId ?? '');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderFormValues>();

  // Populate form when editing and data arrives
  React.useEffect(() => {
    if (isEdit && existingOrder) {
      reset({
        customer: existingOrder.customer,
        customerEmail: existingOrder.customerEmail ?? '',
        customerPhone: existingOrder.customerPhone ?? '',
        shippingAddress: existingOrder.shippingAddress ?? '',
        totalAmount: String(existingOrder.totalAmount / 100),
        currency: existingOrder.currency ?? 'CNY',
        status: existingOrder.status,
      });
    }
  }, [isEdit, existingOrder, reset]);

  function onSubmit(values: OrderFormValues) {
    const amount = Math.round(parseFloat(values.totalAmount) * 100);
    const basePayload = {
      customer: values.customer,
      customerEmail: values.customerEmail || undefined,
      customerPhone: values.customerPhone || undefined,
      shippingAddress: values.shippingAddress || undefined,
      currency: values.currency || undefined,
    };

    if (isEdit && orderId) {
      updateMutation.mutate(
        { ...basePayload, totalAmount: isNaN(amount) ? undefined : amount } as UpdateOrderDTO,
        { onSuccess: () => router.back() },
      );
    } else {
      createMutation.mutate(
        { ...basePayload, totalAmount: isNaN(amount) ? 0 : amount } as CreateOrderDTO,
        { onSuccess: () => router.back() },
      );
    }
  }

  const mutationPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        {isEdit ? '编辑订单' : '创建订单'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          name="customer"
          label="客户名称"
          placeholder="请输入客户名称"
          register={register('customer', { required: '客户名称为必填项' })}
          error={errors.customer?.message}
          required
        />

        <FormField
          name="customerEmail"
          label="邮箱"
          type="email"
          placeholder="请输入邮箱"
          register={register('customerEmail')}
          error={errors.customerEmail?.message}
        />

        <FormField
          name="customerPhone"
          label="电话"
          placeholder="请输入电话"
          register={register('customerPhone')}
          error={errors.customerPhone?.message}
        />

        <FormField
          name="shippingAddress"
          label="收货地址"
          placeholder="请输入收货地址"
          register={register('shippingAddress')}
          error={errors.shippingAddress?.message}
        />

        <FormField
          name="totalAmount"
          label="金额 (元)"
          type="number"
          step="0.01"
          placeholder="0.00"
          register={register('totalAmount', { required: '金额为必填项' })}
          error={errors.totalAmount?.message}
          required
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            货币
          </label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('currency')}
          >
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={mutationPending}
          >
            取消
          </Button>
          <Button type="submit" disabled={mutationPending}>
            {mutationPending ? '提交中...' : isEdit ? '保存' : '创建'}
          </Button>
        </div>
      </form>
    </div>
  );
}
