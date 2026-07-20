'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { RoleStatusTag, RoleMenuTree } from '@myorg/modules/role/ui';
import {
  useRoleDetailQuery,
  useMenuTreeQuery,
} from '@myorg/modules/role/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

function parseRoleId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * RoleViewPage — 角色详情只读页。
 *
 * 迁移自 td-manage `src/pages/sys/role/view.tsx`（112 行）。
 * - roleId 从 useSearchParams 取（路由 /sys/role/view?roleId=X）。
 * - 只读展示 roleName、status（RoleStatusTag）。
 * - 授权菜单树：RoleMenuTree disabled，checkedMenuIds 取详情 menuIdList
 *   （内部会过滤为叶子渲染，role.md 5.2/7.2）。
 */
export function RoleViewPage() {
  const t = useTranslations('modules.role');
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleId = parseRoleId(searchParams.get('roleId'));

  const { data: detail, isLoading } = useRoleDetailQuery(PROJECT_ID, roleId);
  const { data: menuList } = useMenuTreeQuery(PROJECT_ID, Boolean(roleId));

  if (!roleId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('invalidId')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/sys/role')}
        >
          {t('action.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">{t('view.title')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.roleName')}</label>
            <div className="text-sm">
              {isLoading ? '—' : detail?.roleName || '—'}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.status')}</label>
            <div>
              {detail ? (
                <RoleStatusTag
                  status={detail.status}
                  enabledLabel={t('status.enabled')}
                  disabledLabel={t('status.disabled')}
                />
              ) : (
                '—'
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('field.menu')}</div>
        {menuList?.length ? (
          <RoleMenuTree
            menuList={menuList}
            checkedMenuIds={detail?.menuIdList ?? []}
            disabled
            translate={t}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/sys/role')}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
