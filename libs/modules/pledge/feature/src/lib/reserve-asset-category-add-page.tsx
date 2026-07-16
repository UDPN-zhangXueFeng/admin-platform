'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, Input } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAddAssetCategoryMutation } from '@myorg/modules/pledge/data-access';

/**
 * ReserveAssetCategoryAddPage —— 新增资产类别页（独立路由，create pageKey）。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/asset-ategory.tsx
 * （文件名 typo，实为 asset-category）。原路由由 reserve-asset-list 列表页的
 * AddAssetCategory 行操作跳入，query 带三个参数：currency / reserveAssetName /
 * reserveAccountId（见 reserve-asset-list-page.tsx handleRowAction 'AddAssetCategory'）。
 *
 * group 机制下路由为 `/pledge/reserve-asset-list/create?id=...&...`，
 * create pageKey 对应 manifest（module-manifest.ts）。
 *
 * 关键逻辑（对齐源码）：
 * 1. **货币 / 储备资产名只读回填**：从 useSearchParams 读 `currency` /
 *    `reserveAssetName`，源码有 `|| 'EUR'` / `|| 'EUR Reserve Asset 01'` 兜底，
 *    迁移后改为空串兜底（列表页跳转已带 currency/reserveAssetName）。
 * 2. **useFieldArray 动态多条资产类别**：初始一条（`[{value:''}]`），可增删；
 *    每条 Input 校验 required + max 50 + 正则 `/^[A-Za-z0-9 _-]{1,50}$/`
 *    （源码 line 86-95 rules 照搬）。fields.length > 1 时显示 Remove。
 * 3. **提交**：filter(trim) 得 categoryNameList（源码 line 29-30，去掉空白条目），
 *    调 useAddAssetCategoryMutation，参数 `{ categoryNameList, reserveAccountId }`
 *    （源码 `Number(query.reserveAccountId)`）。成功 toast + router.push 列表。
 *
 * 组件映射：antd Form/List → react-hook-form useFieldArray + Controller（每条 Input
 * 受控 + 校验）；antd Button → @myorg/shared/ui Button；antd message → sonner toast。
 */
interface CategoryFormValues {
  /** 动态多条资产类别名称（useFieldArray，初始 [{value:''}]）。 */
  assetCategories: { value: string }[];
}

/** 资产类别名称正则：1-50 位字母/数字/空格/下划线/连字符（对齐源码 line 92）。 */
const ASSET_CATEGORY_PATTERN = /^[A-Za-z0-9 _-]{1,50}$/;

/** 资产类别名称最大长度（对齐源码 line 90 max: 50）。 */
const ASSET_CATEGORY_MAX = 50;

export function ReserveAssetCategoryAddPage(): React.JSX.Element {
  const t = useTranslations('modules.pledge');
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── query 参数回填（只读）──
  // 源码用 `query.currency || 'EUR'` / `query.reserveAssetName || '...'` 兜底，
  // 迁移后无 query 时显示空串（列表页跳转已带 currency/reserveAssetName）。
  const currency = searchParams.get('currency') ?? '';
  const reserveAssetName = searchParams.get('reserveAssetName') ?? '';
  const reserveAccountId = Number(searchParams.get('reserveAccountId') ?? '');

  // ── 表单（useFieldArray 多条资产类别）──
  // 对齐源码 Form.List name="assetCategories" + 初始 setFieldsValue([''])。
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    defaultValues: { assetCategories: [{ value: '' }] },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'assetCategories',
  });

  // ── 提交 ──
  const addCategoryMutation = useAddAssetCategoryMutation();

  const onSubmit = handleSubmit((values) => {
    // filter(trim) 得非空条目（对齐源码 line 29-30，去掉空白/未填的条目）。
    const categoryNameList = (values.assetCategories ?? [])
      .map((item) => item.value?.trim() ?? '')
      .filter((name) => name.length > 0);

    addCategoryMutation.mutate(
      { categoryNameList, reserveAccountId },
      {
        onSuccess: () => {
          toast.success(t('createSuccess'));
          router.push({ pathname: '/pledge/reserve-asset-list' });
        },
        onError: () => toast.error(t('operateSuccess')),
      },
    );
  });

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 text-base font-bold">{t('categoryAdd.title')}</div>

      <form
        onSubmit={onSubmit}
        className="flex w-3/5 flex-col gap-4"
        aria-label={t('categoryAdd.title')}
        noValidate
      >
        {/* Currency：只读回填（源码 Input disabled）。 */}
        <div>
          <label
            htmlFor="category-add-currency"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('field.currency')}
          </label>
          <Input id="category-add-currency" value={currency} disabled readOnly />
        </div>

        {/* Reserve Asset Name：只读回填（源码 Input disabled）。 */}
        <div>
          <label
            htmlFor="category-add-reserve-asset-name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('field.accountName')}
          </label>
          <Input
            id="category-add-reserve-asset-name"
            value={reserveAssetName}
            disabled
            readOnly
          />
        </div>

        {/* Asset Category：useFieldArray 动态多条（源码 Form.List）。 */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t('field.assetCategories')}
          </span>
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const fieldError = errors.assetCategories?.[index]?.value;
              return (
                <div key={field.id} className="flex w-full items-start gap-2">
                  <Controller
                    control={control}
                    name={`assetCategories.${index}.value` as const}
                    rules={{
                      required: t('categoryAdd.required'),
                      maxLength: {
                        value: ASSET_CATEGORY_MAX,
                        message: t('categoryAdd.max'),
                      },
                      pattern: {
                        value: ASSET_CATEGORY_PATTERN,
                        message: t('categoryAdd.pattern'),
                      },
                    }}
                    render={({ field: inputField }) => (
                      <div className="min-w-0 flex-1">
                        <Input
                          {...inputField}
                          value={inputField.value ?? ''}
                          placeholder={t('categoryAdd.placeholder')}
                          aria-invalid={!!fieldError}
                        />
                        {fieldError ? (
                          <p
                            className="mt-1 text-sm text-destructive"
                            role="alert"
                          >
                            {fieldError.message}
                          </p>
                        ) : null}
                      </div>
                    )}
                  />
                  {fields.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => remove(index)}
                    >
                      {t('categoryAdd.remove')}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* + Add：追加一条空类别（源码 Button onClick={() => add()}）。 */}
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => append({ value: '' })}
          >
            {t('categoryAdd.add')}
          </Button>
        </div>

        {/* 操作按钮（源码 Back / Submit）。 */}
        <div className="mt-8 flex justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={addCategoryMutation.isPending}
          >
            {t('categoryAdd.back')}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={addCategoryMutation.isPending}>
            {t('categoryAdd.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ReserveAssetCategoryAddPage;
