'use client';

/**
 * 预授权监控页（G3 流动性组，源 `src/views/preauth/index.vue` 1:1 迁移，
 * 迁移矩阵 §D5 只读快照页）。
 *
 * 源语义保真点：
 * - 顶部 info 提示条固定文案：预授权操作在货币系统完成，本页无提交入口，
 *   快照由管理侧经银行 Gateway 轮询推送；
 * - SyncRefreshButton domain='preauth'，@refreshed 仅重拉列表（不刷池下拉）；
 * - onMounted 同时拉列表 + 池下拉（两侧独立 hook 并行首载）；
 * - 筛选资金池下拉 clearable（哨兵值等价）、label `${tokenCode} (${maskAddress(
 *   poolAddress)})`（v2 源本地副本字段，01 §D4/D5 口径）；
 * - 9 列：快照ID、池ID、币种、4 金额列右对齐（授权/已用/可代转/剩余）、
 *   有效期至 validTo 空 → '-'、快照时间；无分页（全量列表）；空态文案。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';
import { Info } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DataTable,
} from '@myorg/shared/ui';
import { FormSelect, type SelectOption } from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  usePoolListQuery,
  usePreauthListQuery,
  type PreauthRow,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import { formatMoney, formatTime, maskAddress } from './format';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;

const LBL = {
  eyebrow: 'LIQUIDITY',
  title: 'Pre-authorization Monitoring',
  alertTitle: 'Pre-authorizations are managed in the currency system',
  alertBody:
    'LP operators set pre-authorization in the corresponding currency system (on-chain approve etc.). The platform polls quota figures through the bank gateway and pushes snapshots to this list — there is no submission entry here.',
  query: 'Search',
  reset: 'Reset',
  empty: 'No pre-authorization snapshots',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value，非 ALL 即转实参查询）。 */
const ALL = 'all';

interface PoolFilterForm {
  poolId: string;
}

const EMPTY_FILTER: PoolFilterForm = { poolId: ALL };

/** 已提交查询参数（poolId undefined 不进请求体）。 */
interface PreauthParams {
  poolId?: number;
}

function formToParams(f: PoolFilterForm): PreauthParams {
  return { poolId: f.poolId !== ALL ? Number(f.poolId) : undefined };
}

/* ================================================================== */
/* 单元格渲染                                                           */
/* ================================================================== */

/** 金额单元格：formatMoney + 右对齐（源 4 金额列 align="right"）。 */
function MoneyCell({ v }: { v: number }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {formatMoney(v)}
    </span>
  );
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

export function PreauthListPage() {
  const { handleSubmit, reset, control } = useForm<PoolFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [params, setParams] = React.useState<PreauthParams>(() =>
    formToParams(EMPTY_FILTER),
  );

  // 主表数据源（按已提交 poolId 进 key）与池下拉数据源（pool 域 list 直接
  // 消费），挂载即并行首载，互不依赖——对应源 onMounted 双请求。
  const listQuery = usePreauthListQuery(PROJECT_ID, {
    poolId: params.poolId,
  });
  const { data: poolRows } = usePoolListQuery(PROJECT_ID);

  const rows = listQuery.data ?? [];

  /**
   * 源「查询/重置」均无条件 load()：参数变化走 setParams 触发重查；
   * 参数未变时显式 refetch 补齐无条件刷新语义。
   */
  const applyFilter = React.useCallback(
    (next: PreauthParams) => {
      if (next.poolId === params.poolId) {
        void listQuery.refetch();
        return;
      }
      setParams(next);
    },
    [params.poolId, listQuery],
  );

  /** 池下拉 options（label `${tokenCode} (${maskAddress(poolAddress)})`，01 §D5 口径）。 */
  const poolOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'All Pools' },
      ...(poolRows ?? []).map((p) => ({
        value: String(p.poolId),
        label: `${p.tokenCode} (${maskAddress(p.poolAddress)})`,
      })),
    ],
    [poolRows],
  );

  const columns = React.useMemo<ColumnDef<PreauthRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'preauthId',
        header: 'Snapshot ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.preauthId}
          </span>
        ),
      },
      {
        accessorKey: 'poolId',
        header: 'Pool ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.poolId}
          </span>
        ),
      },
      { accessorKey: 'currency', header: 'Currency' },
      {
        accessorKey: 'authAmount',
        header: 'Authorized Quota',
        cell: ({ row }) => <MoneyCell v={row.original.authAmount} />,
      },
      {
        accessorKey: 'usedAmount',
        header: 'Used Quota',
        cell: ({ row }) => <MoneyCell v={row.original.usedAmount} />,
      },
      {
        accessorKey: 'availableAmount',
        header: 'Transferable Quota',
        cell: ({ row }) => <MoneyCell v={row.original.availableAmount} />,
      },
      {
        accessorKey: 'remaining',
        header: 'Remaining Quota',
        cell: ({ row }) => <MoneyCell v={row.original.remaining} />,
      },
      {
        accessorKey: 'validTo',
        header: 'Valid Until',
        // validTo 空（null）显 '-'，不落 formatTime 的兜底口径
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.validTo ? formatTime(row.original.validTo) : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'snapshotTime',
        header: 'Snapshot Time',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.snapshotTime)}
          </span>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.preauthId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>
        {/* 源 @refreshed="load"：仅重拉当前筛选下的列表 */}
        <SyncRefreshButton
          domain="preauth"
          onRefreshed={() => void listQuery.refetch()}
        />
      </div>

      {/* 固定 info 提示条：只读监控页，无提交入口（源 el-alert info 文案位） */}
      <Alert>
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <AlertTitle>{LBL.alertTitle}</AlertTitle>
          <AlertDescription>{LBL.alertBody}</AlertDescription>
        </div>
      </Alert>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="px-6 pt-6">
          <form
            onSubmit={handleSubmit((f) => applyFilter(formToParams(f)))}
            className="mb-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormSelect
                name="poolId"
                control={control}
                label="Liquidity Pool"
                options={poolOptions}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit">{LBL.query}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset(EMPTY_FILTER);
                  applyFilter(formToParams(EMPTY_FILTER));
                }}
              >
                {LBL.reset}
              </Button>
            </div>
          </form>
        </div>

        <div className="px-6 pb-6">
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={listQuery.isPending}
            emptyMessage={LBL.empty}
          />
        </div>
      </div>
    </div>
  );
}
