'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Button,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  useAddReserveAssetMutation,
  useAssetCategoryListQuery,
  useCurrencyListQuery,
  useEditReserveAssetMutation,
  type ReserveAssetListItem,
} from '@myorg/modules/pledge/data-access';
import { buildNameToIdMap } from '@myorg/modules/pledge/util';

/**
 * ReserveAssetDrawer —— 储备资产新增/编辑共用 Drawer（从 reserve-asset-list-page 抽出）。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/index.tsx 的 form1 双表单
 * （line 540-591 onFinish + line 600-700 Drawer 渲染）。antd Form/Checkbox.Group →
 * react-hook-form + Radix Checkbox 列表（@myorg/shared/ui 无 Checkbox.Group，用
 * Controller 包多个 Checkbox 实现 name 数组的勾选/取消）。
 *
 * type 分支（对照源码 form1）：
 * - 'new'：Currency（Select 必填）+ assetName（Input，30 字符正则）+ Asset Category
 *   显示只读 Input「Cash」（非 Checkbox.Group）。提交时从 category/list 取
 *   assetCategoryName==='Cash' 的 assetTypeId 塞入 assetCategoryList。
 * - 'edit'：Currency（disabled 只读）+ assetName（disabled 只读）+ Asset Category
 *   显示 Checkbox 列表（选项来自 record.categorieList，value=assetTypeName，
 *   status===1 默认勾选）。提交时 name→id 映射（record.categorieList 的
 *   assetTypeName→assetTypeId，filter typeof assetTypeId === 'number'）。
 *
 * 字段修正说明：源码 new 态取 `cashCategory?.assetCategoryId`，但后端
 * AssetCateGoryRespVo 实际字段是 `assetTypeId`（见 typings data-contracts.ts:6519），
 * 源码的 assetCategoryId 取不到值 —— 此处按 typings 正确字段 assetTypeId 实现。
 */
export interface DrawerState {
  type: 'new' | 'edit';
  record?: ReserveAssetListItem;
}

export interface ReserveAssetDrawerProps {
  open: boolean;
  drawerState: DrawerState | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Drawer 表单值（new/edit 共用一个 form 实例）。
 * - currency / assetName：两态都有（new 可编辑，edit 只读）。
 * - assetCategories：edit 态为勾选的 assetTypeName 数组；new 态不使用（Cash 为
 *   只读展示，不进 form 状态/校验/提交）。
 */
interface DrawerFormValues {
  currency: string;
  assetName: string;
  assetCategories?: string[];
}

/** 资产名正则：1-30 位字母/数字/空格/下划线/连字符（对齐源码）。 */
const ASSET_NAME_PATTERN = /^[A-Za-z0-9 _-]{1,30}$/;

export function ReserveAssetDrawer({
  open,
  drawerState,
  onClose,
  onSuccess,
}: ReserveAssetDrawerProps): React.JSX.Element {
  const t = useTranslations('modules.pledge');
  const isEdit = drawerState?.type === 'edit';

  // ── 下拉数据源 ──
  // Currency：new 态下拉；edit 态只读展示 record.currency。
  const currencyQuery = useCurrencyListQuery();
  // Asset category list：new 态查 Cash id（源码 reserveAccountId:0 拉全量类别）。
  const assetCategoryQuery = useAssetCategoryListQuery({});

  const currencyOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return (currencyQuery.data ?? [])
      .filter((c) => !!c.value)
      .map((c) => ({ value: String(c.value), label: c.key ?? '' }))
      .filter((opt) => {
        if (seen.has(opt.value)) return false;
        seen.add(opt.value);
        return true;
      });
  }, [currencyQuery.data]);

  // new 态：Cash 资产类别 id（assetCategoryName==='Cash' 的 assetTypeId）。
  const cashCategoryId = React.useMemo(() => {
    const cash = (assetCategoryQuery.data ?? []).find(
      (el) => el?.assetCategoryName === 'Cash',
    );
    return typeof cash?.assetTypeId === 'number' ? cash.assetTypeId : undefined;
  }, [assetCategoryQuery.data]);

  // edit 态：Checkbox 选项（value=assetTypeName）+ 默认勾选（status===1）。
  // filter assetTypeName 非空（对齐源码 line 488-494 buildAssetCategoryOptions）。
  const categoryCheckboxes = React.useMemo(() => {
    const list = drawerState?.record?.categorieList ?? [];
    return list
      .filter((el) => !!el?.assetTypeName)
      .map((el) => ({
        label: el.assetTypeName as string,
        value: el.assetTypeName as string,
      }));
  }, [drawerState?.record?.categorieList]);

  // ── 表单 ──
  // new 与 edit 共用一个 form 实例，按 isEdit 切换校验规则与 disabled。
  // assetCategories 仅 edit 态用（Cash 只读展示，不进 form）。
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DrawerFormValues>({
    defaultValues: {
      currency: '',
      assetName: '',
      assetCategories: [],
    },
  });

  // open/type 变化时回填：edit 态塞 record 字段 + status===1 勾选；new 态清空。
  React.useEffect(() => {
    if (!open || !drawerState) return;
    if (drawerState.type === 'edit') {
      const selected = (drawerState.record?.categorieList ?? [])
        .filter((el) => !!el?.assetTypeName && el.status === 1)
        .map((el) => el.assetTypeName as string);
      reset({
        currency: drawerState.record?.currency ?? '',
        assetName: drawerState.record?.accountName ?? '',
        assetCategories: selected,
      });
    } else {
      reset({ currency: '', assetName: '', assetCategories: [] });
    }
  }, [open, drawerState, reset]);

  // ── 提交 ──
  const addMutation = useAddReserveAssetMutation();
  const editMutation = useEditReserveAssetMutation();
  const isPending = addMutation.isPending || editMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    if (!drawerState) return;
    if (drawerState.type === 'new') {
      // new：默认 Cash id（取不到传空数组，对齐源码 cashCategoryId ? [id] : []）。
      addMutation.mutate(
        {
          currency: values.currency,
          assetName: values.assetName,
          assetCategoryList: cashCategoryId ? [cashCategoryId] : [],
        },
        {
          onSuccess: () => {
            toast.success(t('createSuccess'));
            onSuccess?.();
            onClose();
          },
          onError: () => toast.error(t('operateSuccess')),
        },
      );
    } else {
      // edit：name→id 映射（record.categorieList 的 assetTypeName→assetTypeId，
      // filter typeof assetTypeId === 'number'，对齐源码 line 562-572）。
      // 纯函数 buildNameToIdMap 已抽到 util 层并单测守护（空 categorieList 兜底）。
      const nameToIdMap = buildNameToIdMap(drawerState.record?.categorieList);
      const selectedNames = values.assetCategories ?? [];
      const selectedIds = selectedNames
        .map((name) => nameToIdMap.get(name))
        .filter((id): id is number => typeof id === 'number');

      editMutation.mutate(
        {
          reserveAccountId: drawerState.record?.reserveAccountId ?? 0,
          assetCategoryList: selectedIds,
        },
        {
          onSuccess: () => {
            toast.success(t('editSuccess'));
            onSuccess?.();
            onClose();
          },
          onError: () => toast.error(t('operateSuccess')),
        },
      );
    }
  });

  const handleCancel = React.useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) handleCancel();
      }}
    >
      <DrawerContent className="sm:w-[480px] sm:max-w-[480px]">
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? t('drawer.editTitle') : t('drawer.newTitle')}
          </DrawerTitle>
        </DrawerHeader>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 px-6 pb-2 pt-2"
          aria-label={isEdit ? t('drawer.editTitle') : t('drawer.newTitle')}
        >
          {/* Currency：new 态 Select 必填；edit 态 disabled 只读。 */}
          <Controller
            control={control}
            name="currency"
            rules={isEdit ? undefined : { required: t('drawer.currencyPlaceholder') }}
            render={({ field }) => (
              <div>
                <label
                  htmlFor="reserve-asset-currency"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('drawer.currencyLabel')}
                  {!isEdit ? (
                    <span className="ml-0.5 text-destructive" aria-hidden="true">
                      *
                    </span>
                  ) : null}
                </label>
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={isEdit}
                >
                  <SelectTrigger
                    id="reserve-asset-currency"
                    aria-invalid={!!errors.currency}
                  >
                    <SelectValue placeholder={t('drawer.currencyPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.currency ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {errors.currency.message}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* Reserve Asset Name：new 态 Input + 30 字符正则；edit 态 disabled 只读。 */}
          <Controller
            control={control}
            name="assetName"
            rules={{
              required: isEdit ? false : t('drawer.nameRequired'),
              maxLength: { value: 30, message: t('drawer.nameMax') },
              pattern: { value: ASSET_NAME_PATTERN, message: t('drawer.namePattern') },
            }}
            render={({ field }) => (
              <div>
                <label
                  htmlFor="reserve-asset-name"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('drawer.nameLabel')}
                </label>
                <Input
                  id="reserve-asset-name"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={t('drawer.namePlaceholder')}
                  disabled={isEdit}
                  aria-invalid={!!errors.assetName}
                />
                {errors.assetName ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {errors.assetName.message}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* Asset Category：edit 态 Checkbox 列表；new 态 Cash 只读 Input。 */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              {t('drawer.categoryLabel')}
            </span>
            {isEdit ? (
              <Controller
                control={control}
                name="assetCategories"
                rules={{
                  validate: (v) =>
                    Array.isArray(v) && v.length > 0
                      ? true
                      : t('drawer.categoryRequired'),
                }}
                render={({ field }) => {
                  const selected: string[] = Array.isArray(field.value)
                    ? (field.value as string[])
                    : [];
                  return (
                    <div className="flex flex-col gap-3">
                      {categoryCheckboxes.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {t('empty')}
                        </span>
                      ) : null}
                      {categoryCheckboxes.map((opt) => {
                        const checked = selected.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next =
                                  v === true
                                    ? Array.from(new Set([...selected, opt.value]))
                                    : selected.filter((x) => x !== opt.value);
                                field.onChange(next);
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                      {errors.assetCategories ? (
                        <p className="mt-1 text-sm text-destructive" role="alert">
                          {String(errors.assetCategories.message)}
                        </p>
                      ) : null}
                    </div>
                  );
                }}
              />
            ) : (
              // new 态：Cash 只读 Input（对齐源码 <Input value="Cash" disabled />）。
              <Input value="Cash" disabled readOnly />
            )}
          </div>
        </form>

        <DrawerFooter className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('action.cancel')}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending}>
            {t('action.confirm')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default ReserveAssetDrawer;
