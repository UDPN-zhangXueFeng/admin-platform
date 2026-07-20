'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button, Checkbox, Input, useToast } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  isValidEmail,
  isValidUserName,
  USER_NAME_MAX_LENGTH,
} from '@myorg/modules/user/util';
import {
  useRoleOptionsQuery,
  useSaveUserMutation,
  useTdOptionsQuery,
  useUpdateUserMutation,
  useUserDetailQuery,
} from '@myorg/modules/user/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

/** 旧页提交时硬编码的 orgId（user.md §4.2 注释）。 */
const DEFAULT_ORG_ID = 1;

interface UserFormValues {
  userName: string;
  email: string;
  phoneNumber: string;
  roleIds: number[];
  tdIds: number[];
}

function parseUserId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * UserFormPage — 新增/编辑二合一表单页。
 *
 * 迁移自 td-manage `src/pages/sys/user/edit.tsx`（258 行）。
 * - userId 有无区分：有 → 编辑态（useUserDetailQuery 回填，userName disabled，
 *   提交调 update）；无 → 新增态（提交调 save，loginName=userName）。
 * - 字段：userName（正则 + 编辑禁用）/ email（必填+格式）/ phoneNumber（选填）/
 *   roleIds（多选必填）/ tdIds（多选选填）。
 *
 * 角色→TD 联动（`setTokenType`，user.md §5.3，业务最核心规则）：
 *  - 启动时从 roleList 扫描出管理员角色 id（roleType===0）。
 *  - 勾选含管理员角色 → 自动全选 TD 且禁用 TD 选择框。
 *  - 取消到 roleIds 为空 → 清空 TD。
 *  - roleIds 非空但不含管理员 → TD 保持当前值不变（旧逻辑）。
 *  - 编辑回填 detail 后立即触发一次联动（保证 disabled 状态正确）。
 *
 * Checkbox 渲染：共享 UI 的 Checkbox 是单个 Radix Root（无 Checkbox.Group），
 * 按 role/syslog 模式自渲染勾选集合，经 Controller 接入 RHF。
 */
export function UserFormPage() {
  const t = useTranslations('modules.user');
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = parseUserId(searchParams.get('userId'));
  const isEdit = userId != null;

  const { data: detail } = useUserDetailQuery(PROJECT_ID, userId);
  const { data: roleList } = useRoleOptionsQuery(PROJECT_ID);
  const { data: tdList } = useTdOptionsQuery(PROJECT_ID);
  const saveMutation = useSaveUserMutation(PROJECT_ID);
  const updateMutation = useUpdateUserMutation(PROJECT_ID);

  const { control, register, handleSubmit, reset, setValue } =
    useForm<UserFormValues>({
      defaultValues: {
        userName: '',
        email: '',
        phoneNumber: '',
        roleIds: [],
        tdIds: [],
      },
    });

  // 管理员角色 id（roleType===0，user.md §5.3）。旧页取首个匹配项。
  const adminRoleId = React.useMemo(() => {
    const admin = roleList?.find((r) => r.roleType === 0);
    return admin?.roleId ?? 0;
  }, [roleList]);

  const allTdIds = React.useMemo(
    () => (tdList ?? []).map((td) => td.stablecoinId),
    [tdList]
  );

  /**
   * 角色→TD 联动（复刻旧页 setTokenType）。
   * - roleIds 空 → 清空 tdIds。
   * - roleIds 含管理员 → 全选 tdIds。
   * - roleIds 非空但不含管理员 → 保持当前 tdIds 不变。
   * 返回 TD 选择框是否应禁用（含管理员角色时为 true）。
   */
  const applyRoleLinkage = React.useCallback(
    (roleIds: number[]) => {
      if (!roleIds || roleIds.length === 0) {
        setValue('tdIds', []);
        return false;
      }
      const isAdmin = adminRoleId > 0 && roleIds.includes(adminRoleId);
      if (isAdmin) {
        setValue('tdIds', allTdIds);
      }
      // 非管理员非空：保持当前 tdIds（旧逻辑不做改动）。
      return isAdmin;
    },
    [adminRoleId, allTdIds, setValue]
  );

  // TD 是否禁用：当 roleIds 含管理员角色。直接派生自当前 roleIds 值，保证 UI 一致。
  const [tdDisabled, setTdDisabled] = React.useState(false);

  // 编辑态：detail 返回后回填，并立即触发一次联动（保证 disabled 状态正确）。
  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset({
      userName: detail.userName ?? '',
      email: detail.email ?? '',
      phoneNumber: detail.phoneNumber ?? '',
      roleIds: detail.roleIds ?? [],
      tdIds: detail.tdIds ?? [],
    });
    setTdDisabled(applyRoleLinkage(detail.roleIds ?? []));
  }, [detail, isEdit, reset, applyRoleLinkage]);

  const toast = useToast();

  const onSubmit = handleSubmit((values) => {
    if (isEdit && userId) {
      updateMutation.mutate(
        {
          userId,
          userName: values.userName,
          email: values.email,
          phoneNumber: values.phoneNumber,
          roleIds: values.roleIds,
          tdIds: values.tdIds,
          orgId: DEFAULT_ORG_ID,
        },
        {
          onSuccess: () => {
            toast.success(t('action.saveSuccess'));
            router.push('/sys/user');
          },
          onError: () => toast.error(t('action.saveFailed')),
        }
      );
    } else {
      saveMutation.mutate(
        {
          userName: values.userName,
          loginName: values.userName,
          email: values.email,
          phoneNumber: values.phoneNumber,
          roleIds: values.roleIds,
          tdIds: values.tdIds,
          orgId: DEFAULT_ORG_ID,
        },
        {
          onSuccess: () => {
            toast.success(t('action.saveSuccess'));
            router.push('/sys/user');
          },
          onError: () => toast.error(t('action.saveFailed')),
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
          {/* userName：正则校验 + 编辑态 disabled（user.md §5.3）。 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.userName')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={USER_NAME_MAX_LENGTH}
              disabled={isEdit}
              {...register('userName', {
                validate: (v) =>
                  isValidUserName(v) || t('validation.userName'),
              })}
            />
          </div>

          {/* email：必填 + 格式校验（user.md §5.3）。 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.email')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={100}
              {...register('email', {
                validate: (v) => isValidEmail(v) || t('validation.email'),
              })}
            />
          </div>

          {/* phoneNumber：选填（user.md §5.3，旧页注释掉了 required）。 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.phoneNumber')}</label>
            <Input maxLength={20} {...register('phoneNumber')} />
          </div>
        </div>
      </section>

      {/* roleIds 多选（user.md §5.3）。onChange 触发联动。 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">
          {t('field.roleIds')}
          <span className="ml-0.5 text-red-500">*</span>
        </div>
        {roleList?.length ? (
          <Controller
            control={control}
            name="roleIds"
            rules={{
              validate: (v) => (Array.isArray(v) && v.length > 0) || t('validation.roleIds'),
            }}
            render={({ field }) => (
              <div className="flex flex-col gap-3">
                {roleList.map((item) => {
                  const checked = field.value?.includes(item.roleId) ?? false;
                  // 旧页：status===1 的角色 checkbox 禁用（user.md §4.5）。
                  const disabled = item.status === 1;
                  return (
                    <label
                      key={item.roleId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(c) => {
                          const next = c
                            ? [...(field.value ?? []), item.roleId]
                            : (field.value ?? []).filter(
                                (id) => id !== item.roleId
                              );
                          field.onChange(next);
                          setTdDisabled(applyRoleLinkage(next));
                        }}
                      />
                      {item.roleName}
                    </label>
                  );
                })}
              </div>
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('emptyOptions.role')}</p>
        )}
      </section>

      {/* tdIds 多选（user.md §5.3）。含管理员角色时整体禁用并全选。 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('field.tdIds')}</div>
        {tdList?.length ? (
          <Controller
            control={control}
            name="tdIds"
            render={({ field }) => (
              <div className="flex flex-col gap-3">
                {tdList.map((item) => {
                  const checked = field.value?.includes(item.stablecoinId) ?? false;
                  return (
                    <label
                      key={item.stablecoinId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={tdDisabled}
                        onCheckedChange={(c) => {
                          if (tdDisabled) return;
                          const next = c
                            ? [...(field.value ?? []), item.stablecoinId]
                            : (field.value ?? []).filter(
                                (id) => id !== item.stablecoinId
                              );
                          field.onChange(next);
                        }}
                      />
                      {item.stablecoinName} ({t('field.blockchain')}
                      {item.blockchainName})
                    </label>
                  );
                })}
              </div>
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('emptyOptions.td')}</p>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/sys/user')}
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
