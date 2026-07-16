'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Button,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  useAssetCategoryListQuery,
  useReserveAssetOptionsQuery,
  useSaveReserveAssetTxMutation,
} from '@myorg/modules/pledge/data-access';
import { TRANSACTION_TYPE_OPTIONS } from '@myorg/modules/pledge/util';
import { formatDecimalInput } from '@myorg/modules/pledge/util';

/**
 * AssetTransactionEditPage —— 新建储备资产交易页（create pageKey）。
 *
 * 迁移自 td-manage src/pages/pledge/asset-transaction/edit.tsx。
 * 路由（group 机制）：`/pledge/asset-transaction/create`。
 * 两个入口：
 * - 交易列表页顶部 New（无 query）；
 * - 储备资产列表页 NewTransaction 行操作（带 `?type=asset&reserveAccountId=xxx`
 *   预填，见 reserve-asset-list-page.tsx handleRowAction 'NewTransaction'）。
 *
 * ⚠️ **仅实现新建态**。源码虽有 `if (query.id)` 编辑态分支，但该页路由上只作
 * 新建（New 跳无 id；NewTransaction 跳带 type=asset 无 id），且编辑态
 * form.setFieldsValue 的字段（reserveAssetName/currency/assetCategory/
 * transactionType/quantity/assetValue）与提交参数（assetTypeId/
 * transactionAmount/transactionDirection/unit）字段名不一致，回填逻辑半成品。
 * 按迁移文档第 8 章歧义 7：编辑态不实现（无 query.id 分支）。
 *
 * 关键逻辑（对齐源码）：
 * 1. **储备资产 Select 联动货币 + 资产类别**：选中 → setValue('currency') +
 *    setSelectedReserveAccountId(id) 触发 useAssetCategoryListQuery 重拉 + 清空
 *    assetCategory（源码 handleReserveAssetChange）。type=asset 时该 Select 禁用。
 * 2. **交易类型 RadioGroup**：TRANSACTION_TYPE_OPTIONS（'Inflow'/'Outflow'），
 *    提交时 Inflow→1、Outflow→2（源码 line 190 transactionDirection）。
 * 3. **资产价值两位小数**：onChange 用 formatDecimalInput 清洗（源码
 *    getValueFromEvent line 303-315，已抽到 util/pledge.format）。
 * 4. **type=asset 预填**：从 useSearchParams 读 reserveAccountId，初始
 *    selectedReserveAccountId + options 加载后回填 reserveAssetName/currency
 *    （源码 line 119-136）。
 * 5. **提交**：useSaveReserveAssetTxMutation（tx/save），参数
 *    { assetTypeId, reserveAccountId, transactionDirection, transactionAmount, unit }。
 *
 * 组件映射：antd Form/Select/Radio/Input → react-hook-form Controller +
 * @myorg/shared/ui Select/RadioGroup/Input；antd message → sonner toast。
 */
interface AssetTransactionFormValues {
  /** 储备资产 id（reserveAccountId，string，作 Select value）。 */
  reserveAssetName: string;
  /** 货币（只读联动回填）。 */
  currency: string;
  /** 资产类别（assetCategoryName，string，作 Select value）。 */
  assetCategory: string;
  /** 交易类型（'Inflow' | 'Outflow'，提交时转 1/2）。 */
  transactionType: 'Inflow' | 'Outflow';
  /** 数量（unit）。 */
  quantity: string;
  /** 资产价值（两位小数字符串，提交时 parseFloat）。 */
  assetValue: string;
}

/** 默认表单值（对齐源码 setFieldsValue：transactionType 默认 'Inflow'）。 */
const DEFAULT_VALUES: AssetTransactionFormValues = {
  reserveAssetName: '',
  currency: '',
  assetCategory: '',
  transactionType: 'Inflow',
  quantity: '',
  assetValue: '',
};

export function AssetTransactionEditPage(): React.JSX.Element {
  const t = useTranslations('modules.pledge');
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── query 参数：type=asset 时预填 reserveAccountId（NewTransaction 行操作入口）──
  const queryType = searchParams.get('type');
  const isPresetAsset = queryType === 'asset';
  const presetReserveAccountId = (() => {
    const raw = searchParams.get('reserveAccountId');
    const num = Number(raw ?? '');
    return raw && !Number.isNaN(num) ? num : null;
  })();

  // ── 下拉数据源 ──
  // 储备资产选项（reserve/asset/list，无分页全量）。
  const reserveAssetQuery = useReserveAssetOptionsQuery();
  const reserveAssetOptions = React.useMemo(
    () =>
      (reserveAssetQuery.data ?? []).map((item) => ({
        key: String(item.reserveAccountId ?? ''),
        value: item.accountName ?? '',
        currency: item.currency ?? '',
      })),
    [reserveAssetQuery.data],
  );

  // 选中储备资产 id：联动 category/list（state=1 启用）。
  const [selectedReserveAccountId, setSelectedReserveAccountId] = React.useState<
    number | null
  >(isPresetAsset ? presetReserveAccountId : null);

  const assetCategoryQuery = useAssetCategoryListQuery({
    reserveAccountId: selectedReserveAccountId ?? undefined,
    state: 1,
  });
  // 资产类别选项：label/value 取 assetCategoryName，保留 assetTypeId 供提交。
  const assetCategoryOptions = React.useMemo(
    () =>
      (assetCategoryQuery.data ?? [])
        .filter((el) => !!el?.assetCategoryName)
        .map((el) => ({
          label: el.assetCategoryName as string,
          value: el.assetCategoryName as string,
          assetTypeId: typeof el.assetTypeId === 'number' ? el.assetTypeId : 0,
        })),
    [assetCategoryQuery.data],
  );

  // ── 表单 ──
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AssetTransactionFormValues>({ defaultValues: DEFAULT_VALUES });

  // 储备资产变化时联动货币 + 重拉资产类别 + 清空 assetCategory（源码
  // handleReserveAssetChange line 151-163）。
  const handleReserveAssetChange = React.useCallback(
    (nextKey: string) => {
      const target = reserveAssetOptions.find((el) => el.key === nextKey);
      if (!target) return;
      setValue('currency', target.currency, { shouldValidate: true });
      const numId = Number(target.key);
      setSelectedReserveAccountId(Number.isNaN(numId) ? null : numId);
      setValue('assetCategory', '', { shouldValidate: true });
    },
    [reserveAssetOptions, setValue],
  );

  // type=asset 预填：options 加载后回填 reserveAssetName + currency（源码
  // useEffect line 119-136），仅首次加载时执行一次。
  const presetAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isPresetAsset || presetAppliedRef.current) return;
    if (reserveAssetOptions.length === 0) return;
    const target = reserveAssetOptions.find(
      (el) => presetReserveAccountId !== null && Number(el.key) === presetReserveAccountId,
    );
    if (target) {
      presetAppliedRef.current = true;
      reset({
        ...DEFAULT_VALUES,
        reserveAssetName: target.key,
        currency: target.currency,
      });
    }
  }, [isPresetAsset, reserveAssetOptions, presetReserveAccountId, reset]);

  // ── 提交 ──
  const saveTxMutation = useSaveReserveAssetTxMutation();

  const onSubmit = handleSubmit((values) => {
    const selectedCategory = assetCategoryOptions.find(
      (el) => el.value === values.assetCategory,
    );
    if (!selectedCategory) return;

    // 交易类型 Inflow→1 / Outflow→2（源码 line 190）。
    const transactionDirection = values.transactionType === 'Inflow' ? 1 : 2;
    const reserveAccountId = Number(values.reserveAssetName);

    saveTxMutation.mutate(
      {
        reserveAccountId: Number.isNaN(reserveAccountId) ? 0 : reserveAccountId,
        assetTypeId: selectedCategory.assetTypeId,
        transactionDirection,
        transactionAmount: parseFloat(values.assetValue) || 0,
        unit: values.quantity ?? '',
      },
      {
        onSuccess: () => {
          toast.success(t('createSuccess'));
          router.push({ pathname: '/pledge/asset-transaction' });
        },
        onError: () => toast.error(t('operateSuccess')),
      },
    );
  });

  // 资产价值 addon 后缀（货币码，源码 line 328）。
  const currencySuffix = watch('currency') || 'HKD';

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 text-base font-bold">{t('assetTxnList.newTransaction')}</div>

      <form
        onSubmit={onSubmit}
        className="flex w-3/5 flex-col gap-4"
        aria-label={t('assetTxnList.newTransaction')}
        noValidate
      >
        {/* 储备资产名 Select：联动货币 + 资产类别。type=asset 时 disabled。 */}
        <Controller
          control={control}
          name="reserveAssetName"
          rules={{ required: t('assetTxnEdit.reserveAssetRequired') }}
          render={({ field }) => (
            <div>
              <label
                htmlFor="asset-txn-reserve-asset"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('field.accountName')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => {
                  field.onChange(v);
                  handleReserveAssetChange(v);
                }}
                disabled={isPresetAsset}
              >
                <SelectTrigger
                  id="asset-txn-reserve-asset"
                  aria-invalid={!!errors.reserveAssetName}
                >
                  <SelectValue placeholder={t('assetTxnEdit.reserveAssetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {reserveAssetOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reserveAssetName ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errors.reserveAssetName.message}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* 货币：只读联动回填（源码 Input disabled）。 */}
        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <div>
              <label
                htmlFor="asset-txn-currency"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('field.currency')}
              </label>
              <Input id="asset-txn-currency" value={field.value ?? ''} disabled readOnly />
            </div>
          )}
        />

        {/* 资产类别 Select：选项来自 category/list（reserveAccountId 联动）。 */}
        <Controller
          control={control}
          name="assetCategory"
          rules={{ required: t('assetTxnEdit.categoryRequired') }}
          render={({ field }) => (
            <div>
              <label
                htmlFor="asset-txn-category"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('assetTxnList.assetCategory')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger
                  id="asset-txn-category"
                  aria-invalid={!!errors.assetCategory}
                >
                  <SelectValue placeholder={t('assetTxnEdit.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {assetCategoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assetCategory ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errors.assetCategory.message}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* 交易类型 RadioGroup：Inflow / Outflow，提交时转 1/2。 */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t('assetTxnList.transactionType')}
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </span>
          <Controller
            control={control}
            name="transactionType"
            rules={{ required: t('assetTxnEdit.transactionTypeRequired') }}
            render={({ field }) => (
              <RadioGroup
                value={field.value ?? 'Inflow'}
                onValueChange={(v) => field.onChange(v as 'Inflow' | 'Outflow')}
                className="flex gap-6"
              >
                {TRANSACTION_TYPE_OPTIONS.map((option) => {
                  const id = `asset-txn-type-${option.value.toLowerCase()}`;
                  return (
                    <div key={option.value} className="flex items-center gap-2">
                      <RadioGroupItem value={option.value} id={id} />
                      <label htmlFor={id} className="text-sm">
                        {option.label}
                      </label>
                    </div>
                  );
                })}
              </RadioGroup>
            )}
          />
        </div>

        {/* Quantity（源码 Input type="number"）。 */}
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <div>
              <label
                htmlFor="asset-txn-quantity"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('assetTxnEdit.quantity')}
              </label>
              <Input
                id="asset-txn-quantity"
                type="number"
                inputMode="numeric"
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t('assetTxnEdit.quantityPlaceholder')}
              />
            </div>
          )}
        />

        {/* 资产价值：两位小数校验（formatDecimalInput），addon 后缀货币码。 */}
        <Controller
          control={control}
          name="assetValue"
          rules={{ required: t('assetTxnEdit.assetValueRequired') }}
          render={({ field }) => (
            <div>
              <label
                htmlFor="asset-txn-value"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('field.assetValue')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="asset-txn-value"
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(formatDecimalInput(e.target.value))
                  }
                  onBlur={field.onBlur}
                  placeholder={t('assetTxnEdit.assetValuePlaceholder')}
                  aria-invalid={!!errors.assetValue}
                  className="flex-1"
                />
                <span className="min-w-[3rem] text-sm text-muted-foreground">
                  {currencySuffix}
                </span>
              </div>
              {errors.assetValue ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errors.assetValue.message}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* 操作按钮（源码 Back / Submit）。 */}
        <div className="mt-8 flex justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saveTxMutation.isPending}
          >
            {t('categoryAdd.back')}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={saveTxMutation.isPending}>
            {t('categoryAdd.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AssetTransactionEditPage;
