/**
 * MintingMeltingTab — Tab1：铸销记录表 + Mint / Melt 标题按钮。
 * 源: tokenized-deposit-view-page.tsx 57-58, 186-517（筛选表单拆至 ./record-filter-form）
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button, DataTable } from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatAdminTimestamp } from '../../format-admin-time';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { reSet } from '../re-set';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  REVIEW_SUBMIT_STATE_KEY_PREFIX,
  TD_PERMISSIONS,
} from '@myorg/modules/td-admin/data-access';
import {
  useStablecoinRecordQuery,
  type StablecoinRecordListParams,
  type StablecoinRecordItem,
} from '@myorg/modules/td-admin/data-access';
import type { MintMeltMode } from './mint-melt-modal';
import {
  EMPTY_FILTER,
  RecordFilterForm,
  type RecordFilterFormValues,
} from './record-filter-form';



// ═════════════════════════════════════════════════════════════════════
// Tab1：铸销记录 + Mint / Melt 按钮
// ═════════════════════════════════════════════════════════════════════

interface MintingMeltingTabProps {
  onOpenMintMelt: (mode: MintMeltMode) => void;
  canMint: boolean;
  canMelt: boolean;
}

/**
 * 铸销记录表 + Mint / Melt 标题按钮。
 *
 * endpoint: POST /api/manage/v1/stablecoin/record/query
 * rowKey: recordId（DataTable id 注入）。
 */
export function MintingMeltingTab({
  onOpenMintMelt,
  canMint,
  canMelt,
}: MintingMeltingTabProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [filterValues, setFilterValues] =
    React.useState<RecordFilterFormValues>(EMPTY_FILTER);

  const { control, handleSubmit, reset } = useForm<RecordFilterFormValues>({
    defaultValues: EMPTY_FILTER,
  });
  const [startCreateTime, endCreateTime, startReviewerTime, endReviewerTime] = useWatch({
    control,
    name: ['startCreateTime', 'endCreateTime', 'startReviewerTime', 'endReviewerTime'],
  });

  const params = React.useMemo<StablecoinRecordListParams>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      // Match upstream RangePicker's millisecond boundaries and include the end day.
      txHash: filterValues.txHash || undefined,
      type: filterValues.type === 'all' ? undefined : filterValues.type,
      state: filterValues.state === 'all' ? undefined : filterValues.state,
      startCreateTime: filterValues.startCreateTime ? startOfDay(parseISO(filterValues.startCreateTime)).getTime() : undefined,
      endCreateTime: filterValues.endCreateTime ? endOfDay(parseISO(filterValues.endCreateTime)).getTime() : undefined,
      startReviewerTime: filterValues.startReviewerTime ? startOfDay(parseISO(filterValues.startReviewerTime)).getTime() : undefined,
      endReviewerTime: filterValues.endReviewerTime ? endOfDay(parseISO(filterValues.endReviewerTime)).getTime() : undefined,
    }),
    [pagination.pageNum, pagination.pageSize, filterValues],
  );

  const query = useStablecoinRecordQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  // ── 列定义（对齐源 customTable1 columns，逐列）──
  const columns = React.useMemo<ColumnDef<StablecoinRecordItem>[]>(
    () => [
      {
        // stablecoin_settings_002：txHash
        accessorKey: 'txHash',
        header: t('stablecoin_settings_002'),
        cell: ({ row }) => (
          <span>{row.original.txHash || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // PUB_Type → stablecoin_record_type_{type}
        accessorKey: 'type',
        header: t('PUB_Type'),
        cell: ({ row }) => {
          const type = row.original.type;
          if (type == null || type === '') return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`stablecoin_record_type_${type}`)}</span>;
        },
      },
      {
        // stablecoin_settings_003：name
        accessorKey: 'name',
        header: t('stablecoin_settings_003'),
        cell: ({ row }) => (
          <span>{row.original.name || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // stablecoin_manage_004：金额列（源 view.tsx:141-143 即 reSet(stablecoinCount)，
        // 无 symbol 后缀；undefined 走 reSet 的 '--' 分支）。
        accessorKey: 'stablecoinCount',
        header: t('stablecoin_manage_004'),
        cell: ({ row }) => (
          <span>{reSet(row.original.stablecoinCount)}</span>
        ),
      },
      {
        // PUB_Creater：createUserName
        accessorKey: 'createUserName',
        header: t('PUB_Creater'),
        cell: ({ row }) => (
          <span>{row.original.createUserName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // PUB_CreateTime：createTime（源为时间戳，formatAdminTimestamp）
        accessorKey: 'createTime',
        header: t('PUB_CreateTime'),
        cell: ({ row }) => {
          const val = row.original.createTime;
          return (
            <span>{val ? formatAdminTimestamp(Number(val)) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // stablecoin_settings_031：reviewerUserName
        accessorKey: 'reviewerUserName',
        header: t('stablecoin_settings_031'),
        cell: ({ row }) => (
          <span>
            {row.original.reviewerUserName || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        // PUB_ReviewTime：reviewerTime
        accessorKey: 'reviewerTime',
        header: t('PUB_ReviewTime'),
        cell: ({ row }) => {
          const val = row.original.reviewerTime;
          return (
            <span>{val ? formatAdminTimestamp(Number(val)) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // PUB_Status：review_submit_state_{state}
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ row }) => {
          const state = row.original.state;
          if (state == null || state === '') return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`${REVIEW_SUBMIT_STATE_KEY_PREFIX}${state}`)}</span>;
        },
      },
    ],
    [t],
  );

  // ── 筛选提交 / 重置 ──
  const onFilterSubmit = (values: RecordFilterFormValues) => {
    setFilterValues(values);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  };
  const onFilterReset = () => {
    reset(EMPTY_FILTER);
    setFilterValues(EMPTY_FILTER);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  };

  return (
    <div className="space-y-4">
      {/* 筛选表单（源 form1 items） */}
      <RecordFilterForm
        control={control}
        handleSubmit={handleSubmit}
        onFilterSubmit={onFilterSubmit}
        onFilterReset={onFilterReset}
        startCreateTime={startCreateTime}
        endCreateTime={endCreateTime}
        startReviewerTime={startReviewerTime}
        endReviewerTime={endReviewerTime}
      />

      {/* 标题区 + Mint / Melt 按钮（源 CustomTableTitle，tokenized_deposit_0015） */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('tokenized_deposit_0015')}</h3>
        <div className="flex gap-2">
          {/* Mint → Issuance 文案（源按钮 onClick 第 174-190 行） */}
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_MINT_MELT_TITLE}>
            <Button onClick={() => onOpenMintMelt('Issuance')} disabled={!canMint}>
              {t('Mint')}
            </Button>
          </PermissionGuard>
          {/* Melt → Destruction 文案（源按钮 onClick 第 191-213 行，正确分支）。
              注：源 actionClick Melt 分支（第 237-251 行）误设 Issuance 文案，
              本页不复制 actionClick（表无行操作），仅保留此正确分支 —— 见文件头注释。 */}
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_MINT_MELT_TITLE}>
            <Button variant="outline" onClick={() => onOpenMintMelt('Destruction')} disabled={!canMelt}>
              {t('Melt')}
            </Button>
          </PermissionGuard>
        </div>
      </div>
      {query.isError && (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{t('td_query_load_failed')}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {t('td_retry')}
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('empty')}
        pagination={{
          page: pagination.pageNum,
          pageSize: pagination.pageSize,
          total,
          onPageChange: (p) => setPagination((prev) => ({ ...prev, pageNum: p })),
        }}
      />
    </div>
  );
}
