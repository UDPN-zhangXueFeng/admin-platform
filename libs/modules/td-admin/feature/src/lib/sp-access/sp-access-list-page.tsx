'use client';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';

import { useTranslations } from 'next-intl';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Input,
} from '@myorg/shared/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { PermissionGuard, useAuth } from '@myorg/shared/util-auth';
import {
  useSpAccessListQuery,
  useSpAccessStablecoinOptionsQuery,
  type SpAccessListItem,
} from '@myorg/modules/td-admin/data-access';
import { SpAccessStatusBadge } from './sp-access-status-badge';
import {
  SERVICE_PROVIDER_TYPE_VALUES,
  SP_ACCESS_PERMISSIONS,
} from './constants';
import { EMPTY_FIELD_VALUE, formatTimestamp } from './formatters';

const PAGE_SIZE = 10;
const ALL_VALUE = '';

interface DraftFilters {
  spName: string;
  spType: string;
  contactName: string;
  email: string;
  tdName: string;
  createDateFrom: string;
  createDateTo: string;
  state: string;
}

const EMPTY_DRAFT: DraftFilters = {
  spName: '',
  spType: ALL_VALUE,
  contactName: '',
  email: '',
  tdName: ALL_VALUE,
  createDateFrom: '',
  createDateTo: '',
  state: ALL_VALUE,
};

function dateToRangeMs(from: string, to: string): {
  createStartTime?: number;
  createEndTime?: number;
} {
  return {
    createStartTime: from ? startOfDay(parseISO(from)).getTime() : undefined,
    createEndTime: to ? endOfDay(parseISO(to)).getTime() : undefined,
  };
}

export function SpAccessListPage() {
  const router = useRouter();
  const t = useTranslations('modules.sp-access');
  const { permissions } = useAuth();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);
  const [draft, setDraft] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [applied, setApplied] = React.useState<DraftFilters>(EMPTY_DRAFT);

  const { data: stablecoinOptions } = useSpAccessStablecoinOptionsQuery();

  // 契约（L-01）：spType/state 恒发送（'' 为未筛选）；其余空值剔除
  const { data, isLoading } = useSpAccessListQuery({
    pageNum: page,
    pageSize,
    filters: {
      spName: applied.spName,
      spType: applied.spType,
      contactName: applied.contactName,
      email: applied.email,
      tdName: applied.tdName,
      ...dateToRangeMs(applied.createDateFrom, applied.createDateTo),
      state: applied.state,
    },
  });

  const rows = data?.rows ?? [];
  const canEdit = permissions.has(SP_ACCESS_PERMISSIONS.edit);
  const canView = permissions.has(SP_ACCESS_PERMISSIONS.view);

  const columns = React.useMemo<ColumnDef<SpAccessListItem & { id: string }>[]>(
    () => [
      {
        // 跨页连续序号（PUB_Index）
        id: 'index',
        header: t('PUB_Index'),
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        id: 'spName',
        header: t('sp_access_0000'),
        cell: ({ row }) => row.original.spName ?? EMPTY_FIELD_VALUE,
      },
      {
        id: 'spType',
        header: t('sp_access_0065'),
        cell: ({ row }) =>
          row.original.spType == null
            ? EMPTY_FIELD_VALUE
            : t(`service_provider_type_${row.original.spType}`),
      },
      {
        id: 'contactName',
        header: t('sp_access_0039'),
        cell: ({ row }) => row.original.contactName ?? EMPTY_FIELD_VALUE,
      },
      {
        id: 'email',
        header: t('PUB_Email'),
        cell: ({ row }) => row.original.email ?? EMPTY_FIELD_VALUE,
      },
      {
        // Token 列：tdInfo 图标 + 名称（tooltip 全列，CopyableEllipsisText 承载）
        id: 'td',
        header: t('sp_access_0044'),
        cell: ({ row }) => {
          const tdNames = (row.original.tdInfo ?? [])
            .map((info) => info.tdName)
            .filter((name): name is string => Boolean(name?.trim()));
          const display = tdNames.join(', ') || row.original.td || EMPTY_FIELD_VALUE;
          if (display === EMPTY_FIELD_VALUE) return display;
          return (
            <CopyableEllipsisText value={display} copyable={false} maxWidth={200} />
          );
        },
      },
      {
        id: 'createTime',
        header: t('user_wallet_002'),
        cell: ({ row }) => formatTimestamp(row.original.createTime),
      },
      {
        id: 'state',
        header: t('PUB_Status'),
        cell: ({ row }) => <SpAccessStatusBadge kind="spStatus" status={row.original.state} />,
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => {
          const record = row.original;
          // 上游跳转参数：id=spId（非 spRecordId）
          const detailParams = `id=${record.spId ?? ''}&spCode=${record.spCode ?? ''}`;
          const editEnabled = record.state === 1 || record.state === 2;
          return (
            <div className="flex items-center gap-2">
              {/* 行内按钮权限 = 后端 UUID；授权但 state∉{1,2} 时置灰（上游 disabled 语义） */}
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!editEnabled}
                  onClick={() => router.push(`/sp-access/edit?${detailParams}`)}
                >
                  {t('Router_0004_3')}
                </Button>
              )}
              {canView && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/sp-access/detail?${detailParams}`)}
                >
                  {t('Router_0004_4')}
                </Button>
              )}
              {!canEdit && !canView && <span className="text-muted-foreground">--</span>}
            </div>
          );
        },
      },
    ],
    [router, page, pageSize, canEdit, canView, t],
  );

  const setDraftField = (field: keyof DraftFilters, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  // Query 提交草稿并回到第一页（上游 CustomTable 行为）
  const handleQuery = () => {
    setApplied(draft);
    setPage(1);
  };

  // 列表页 Reset 只清空表单，不自动查询（上游列表/详情两套行为，DISP-5）
  const handleReset = () => {
    setDraft(EMPTY_DRAFT);
  };

  const tdOptions = stablecoinOptions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('sp_access_0002')}</h1>
        <PermissionGuard permission={SP_ACCESS_PERMISSIONS.register}>
          <Button onClick={() => router.push('/sp-access/create')}>
            {t('sp_access_0050')}
          </Button>
        </PermissionGuard>
        {/* 上游 registerAlt 权限命中渲染第二枚同功能按钮，下游合并为一枚（alignment.md L-04 披露） */}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('sp_access_0000')}</label>
            <Input
              value={draft.spName}
              onChange={(event) => setDraftField('spName', event.target.value)}
              placeholder={t('PUB_Pleased')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('sp_access_0065')}</label>
            <Select
              value={draft.spType || ALL_VALUE}
              onValueChange={(value) => setDraftField('spType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {SERVICE_PROVIDER_TYPE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`service_provider_type_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('sp_access_0039')}</label>
            <Input
              value={draft.contactName}
              onChange={(event) => setDraftField('contactName', event.target.value)}
              placeholder={t('PUB_Pleased')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('PUB_Email')}</label>
            <Input
              type="email"
              value={draft.email}
              onChange={(event) => setDraftField('email', event.target.value)}
              placeholder={t('PUB_Pleased')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('sp_access_0044')}</label>
            <Select
              value={draft.tdName || ALL_VALUE}
              onValueChange={(value) => setDraftField('tdName', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {tdOptions.map((option) => (
                  <SelectItem key={option.name} value={option.name ?? ''}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('PUB_CreateTime')}</label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={draft.createDateFrom}
                onChange={(event) => setDraftField('createDateFrom', event.target.value)}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={draft.createDateTo}
                onChange={(event) => setDraftField('createDateTo', event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('PUB_Status')}</label>
            <Select
              value={draft.state || ALL_VALUE}
              onValueChange={(value) => setDraftField('state', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                <SelectItem value="0">{t('sp_status_0')}</SelectItem>
                <SelectItem value="1">{t('sp_status_1')}</SelectItem>
                <SelectItem value="2">{t('sp_status_2')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={handleQuery}>{t('PUB_Query')}</Button>
          <Button variant="outline" onClick={handleReset}>
            {t('PUB_Reset')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows.map((row, index) => ({
          ...row,
          id: String(row.spRecordId ?? row.spId ?? row.spCode ?? index),
        }))}
        isLoading={isLoading}
        emptyMessage={t('sp_access_0002')}
        pagination={{
          page,
          pageSize,
          total: data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
      />
    </div>
  );
}
