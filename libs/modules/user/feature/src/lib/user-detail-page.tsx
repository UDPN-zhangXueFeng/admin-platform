'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button, Checkbox } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { UserStatusBadge } from '@myorg/modules/user/ui';
import {
  useRoleOptionsQuery,
  useTdOptionsQuery,
  useUserDetailQuery,
} from '@myorg/modules/user/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

function parseUserId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 格式化毫秒时间戳（详情页基本字段区，user.md §5.2）。 */
function formatTimestamp(ms: number | undefined): string {
  if (!ms) return '--';
  return new Date(Number(ms)).toLocaleString();
}

/**
 * UserDetailPage — 用户详情只读页。
 *
 * 迁移自 td-manage `src/pages/sys/user/view.tsx`（140 行）。
 * - userId 从 useSearchParams 取（路由 /sys/user/view?userId=X）。
 * - 三个请求并行触发（detail / roleOptions / tdOptions），对齐旧页三个独立 useSWR。
 * - 信息块：基本字段（userName/email/phoneNumber/createTime/updateTime/status）+
 *   TD 多选回显（Checkbox disabled）+ 角色多选回显（Checkbox disabled）。
 *
 * Checkbox 渲染：共享 UI 的 Checkbox 是单个 Radix Root（无 Checkbox.Group），
 * 故按 role/syslog 模式自渲染勾选集合——checked 由 detail 的 tdIds/roleIds 决定，
 * disabled 恒为 true（只读回显）。
 */
export function UserDetailPage() {
  const t = useTranslations('modules.user');
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = parseUserId(searchParams.get('userId'));

  const { data: detail, isLoading } = useUserDetailQuery(PROJECT_ID, userId);
  const { data: roleList } = useRoleOptionsQuery(PROJECT_ID, Boolean(userId));
  const { data: tdList } = useTdOptionsQuery(PROJECT_ID, Boolean(userId));

  if (!userId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('invalidId')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/sys/user')}
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
          <DetailField label={t('field.userName')}>
            {isLoading ? '—' : detail?.userName || '—'}
          </DetailField>
          <DetailField label={t('field.email')}>
            {isLoading ? '—' : detail?.email || '—'}
          </DetailField>
          <DetailField label={t('field.phoneNumber')}>
            {isLoading ? '—' : detail?.phoneNumber || '--'}
          </DetailField>
          <DetailField label={t('field.createTime')}>
            {formatTimestamp(detail?.createTime)}
          </DetailField>
          <DetailField label={t('field.updateTime')}>
            {formatTimestamp(detail?.updateTime)}
          </DetailField>
          <DetailField label={t('field.status')}>
            {detail ? (
              <UserStatusBadge
                status={detail.status}
                enabledLabel={t('status.enabled')}
                disabledLabel={t('status.disabled')}
              />
            ) : (
              '—'
            )}
          </DetailField>
        </div>
      </section>

      {/* TD 多选回显（user.md §5.2，复刻旧页 Checkbox.Group disabled）。 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('field.tdIds')}</div>
        {tdList?.length ? (
          <div className="flex flex-col gap-3">
            {tdList.map((item) => {
              const checked = detail?.tdIds?.includes(item.stablecoinId) ?? false;
              return (
                <label
                  key={item.stablecoinId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox checked={checked} disabled />
                  {item.stablecoinName} ({t('field.blockchain')}
                  {item.blockchainName})
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('emptyOptions.td')}</p>
        )}
      </section>

      {/* 角色多选回显（user.md §5.2）。 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('field.roleIds')}</div>
        {roleList?.length ? (
          <div className="flex flex-col gap-3">
            {roleList.map((item) => {
              const checked = detail?.roleIds?.includes(item.roleId) ?? false;
              return (
                <label
                  key={item.roleId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox checked={checked} disabled />
                  {item.roleName}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('emptyOptions.role')}</p>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/sys/user')}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="text-sm">{children}</div>
    </div>
  );
}
