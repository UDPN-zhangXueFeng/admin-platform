'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  Button,
  Input,
  RadioGroup,
  RadioGroupItem,
  useToast,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { RoleMenuTree } from '@myorg/modules/role/ui';
import { RoleStatus } from '@myorg/modules/role/util';
import {
  useRoleDetailQuery,
  useMenuTreeQuery,
  useSaveRoleMutation,
  useUpdateRoleMutation,
} from '@myorg/modules/role/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

/** 表单值：status 在 schema 层统一为 number（role.md 7.4）。 */
interface RoleFormValues {
  roleName: string;
  status: number;
  menuIdList: number[];
}

function parseRoleId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * RoleFormPage — 新增/编辑二合一表单页。
 *
 * 迁移自 td-manage `src/pages/sys/role/edit.tsx`（197 行）。
 * - roleId 有无区分：有 → 编辑态（useRoleDetailQuery 回填，roleName disabled，
 *   提交调 update）；无 → 新增态（提交调 save）。
 * - roleName：Input maxLength 20，必填，编辑态只读（role.md 7.6 角色名不可改）。
 * - status：RadioGroup，值统一 number（0 启用 / 1 禁用，role.md 7.4）。
 * - menuIdList：RoleMenuTree checkable，onCheck 合并 checkedKeys+halfCheckedKeys
 *   （role.md 5.3：提交全集含半选父节点，避免丢失父级授权）。
 */
export function RoleFormPage() {
  const t = useTranslations('modules.role');
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const roleId = parseRoleId(searchParams.get('roleId'));
  const isEdit = roleId != null;

  const { data: detail } = useRoleDetailQuery(PROJECT_ID, roleId);
  const { data: menuList } = useMenuTreeQuery(PROJECT_ID);
  const saveMutation = useSaveRoleMutation(PROJECT_ID);
  const updateMutation = useUpdateRoleMutation(PROJECT_ID);

  const { control, register, handleSubmit, reset, formState } =
    useForm<RoleFormValues>({
      defaultValues: {
        roleName: '',
        status: RoleStatus.Enabled,
        menuIdList: [],
      },
    });

  // 编辑态：详情返回后回填。status/menuIdList 转 number；roleName 同步。
  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset({
      roleName: detail.roleName ?? '',
      status: Number(detail.status),
      menuIdList: detail.menuIdList ?? [],
    });
  }, [detail, isEdit, reset]);

  const onSubmit = handleSubmit((values) => {
    if (isEdit && roleId) {
      updateMutation.mutate(
        {
          roleId,
          status: values.status,
          menuIdList: values.menuIdList,
        },
        {
          onSuccess: () => {
            toast.success(t('toast.saveSuccess'));
            router.push('/sys/role');
          },
        }
      );
    } else {
      saveMutation.mutate(
        {
          roleName: values.roleName,
          status: values.status,
          menuIdList: values.menuIdList,
        },
        {
          onSuccess: () => {
            toast.success(t('toast.saveSuccess'));
            router.push('/sys/role');
          },
        }
      );
    }
  });

  const submitting = saveMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? t('edit.title') : t('create.title')}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.roleName')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={20}
              disabled={isEdit}
              {...register('roleName', { required: true })}
            />
            {formState.errors.roleName ? (
              <p className="text-xs text-red-500">{t('field.roleName')}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.status')}</label>
            <Controller
              control={control}
              name="status"
              rules={{ required: true }}
              render={({ field }) => (
                <RadioGroup
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value={String(RoleStatus.Enabled)}
                      id="status-enabled"
                    />
                    <label htmlFor="status-enabled" className="text-sm">
                      {t('status.enabled')}
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value={String(RoleStatus.Disabled)}
                      id="status-disabled"
                    />
                    <label htmlFor="status-disabled" className="text-sm">
                      {t('status.disabled')}
                    </label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('field.menu')}</div>
        {menuList?.length ? (
          <Controller
            control={control}
            name="menuIdList"
            render={({ field }) => (
              <RoleMenuTree
                menuList={menuList}
                checkedMenuIds={field.value}
                onCheck={(checkedKeys, halfCheckedKeys) => {
                  // role.md 5.3：提交「叶子+全选父」与「半选父」的并集，
                  // 避免丢失父级菜单授权。
                  field.onChange([...checkedKeys, ...halfCheckedKeys]);
                }}
              />
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/sys/role')}
          disabled={submitting}
        >
          {t('action.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {t('action.save')}
        </Button>
      </div>
    </form>
  );
}
