'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  FREEZE_TARGET_BANK,
  FREEZE_TARGET_LP,
  FREEZE_TARGET_PAIR,
  FREEZE_TARGET_TYPE_LABEL,
  FREEZE_STATUS_ACTIVE,
  FREEZE_STATUS_FROZEN,
  FREEZE_STATUS_LABEL,
  freezeStatusVariant,
  isFreezable,
  useFreezeBankListQuery,
  useFreezeLpListQuery,
  useFreezePairListQuery,
  useFreezeToggleMutation,
  type FreezeBankRow,
  type FreezeLpRow,
  type FreezePairRow,
  HANDLE_STATUS_MAP,
  RULE_CODE_MAP,
  handleStatusVariant,
  useMonitorHitListQuery,
  type MonitorHitRow,
} from '@myorg/modules/kissen-admin/data-access';

/* ============================================================ */
/* 共享格式化 / 展示辅助                                          */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;

/** 毫秒时间戳 → 本地 YYYY-MM-DD HH:mm:ss；0/空 → '--'（目标约定 §4）。 */
function formatTimestamp(ms: number | undefined | null): string {
  if (!ms) return '--';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 路由 search param → 正整数（无效/缺失返回 undefined）。 */
function parsePositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 路由 search param → 整数（允许负数；无效/缺失返回 undefined）。 */
function parseIntOrNull(raw: string | null): number | undefined {
  if (raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
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
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="text-sm tabular-nums">{children}</div>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
      <div className="mb-6 text-base font-semibold">{title}</div>
      {children}
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/* ============================================================ */
/* freeze — 冻结/解冻（聚合三类目标，源无独立 freeze 视图）        */
/* ============================================================ */

/** 冻结列表归一行（三类目标统一为 DataTable 行类型）。 */
interface FreezeListRow {
  id: string;
  targetId: number;
  targetType: number;
  name: string;
  code: string;
  status: number;
}

/** 「全部」状态哨兵值（Radix Select 禁空串 value）。 */
const STATUS_ALL = 'all';

/** 把三类原始行归一为 FreezeListRow（字段重命名 + id 字符串化）。 */
function toFreezeRows(
  targetType: number,
  rows: FreezeBankRow[] | FreezeLpRow[] | FreezePairRow[],
): FreezeListRow[] {
  if (targetType === FREEZE_TARGET_BANK) {
    return (rows as FreezeBankRow[]).map((r) => ({
      id: String(r.bankId),
      targetId: r.bankId,
      targetType: FREEZE_TARGET_BANK,
      name: r.bankName,
      code: r.bankCode,
      status: r.status,
    }));
  }
  if (targetType === FREEZE_TARGET_LP) {
    return (rows as FreezeLpRow[]).map((r) => ({
      id: String(r.lpId),
      targetId: r.lpId,
      targetType: FREEZE_TARGET_LP,
      name: r.lpName,
      code: r.lpCode,
      status: r.status,
    }));
  }
  return (rows as FreezePairRow[]).map((r) => ({
    id: String(r.pairId),
    targetId: r.pairId,
    targetType: FREEZE_TARGET_PAIR,
    name: `${r.sourceCurrency}/${r.targetCurrency}`,
    code: '',
    status: r.status,
  }));
}

export function FreezeListPage() {
  const router = useRouter();
  const toast = useToast();
  const toggleMutation = useFreezeToggleMutation(KISSEN_PROJECT_ID);

  const [targetType, setTargetType] = React.useState<number>(FREEZE_TARGET_BANK);
  const [pageNum, setPageNum] = React.useState(1);
  const [keyword, setKeyword] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<number | undefined>();
  // 已提交筛选（避免每次按键触发查询；点查询才应用）。
  const [applied, setApplied] = React.useState({ keyword: '', status: undefined as number | undefined });

  const bankFilter = {
    bankName: applied.keyword || undefined,
    status: applied.status,
  };
  const lpFilter = {
    lpName: applied.keyword || undefined,
    status: applied.status,
  };
  const pairFilter = {
    sourceCurrency: applied.keyword || undefined,
    status: applied.status,
  };

  const bankQ = useFreezeBankListQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize: PAGE_SIZE_DEFAULT, filter: bankFilter },
    targetType === FREEZE_TARGET_BANK,
  );
  const lpQ = useFreezeLpListQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize: PAGE_SIZE_DEFAULT, filter: lpFilter },
    targetType === FREEZE_TARGET_LP,
  );
  const pairQ = useFreezePairListQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize: PAGE_SIZE_DEFAULT, filter: pairFilter },
    targetType === FREEZE_TARGET_PAIR,
  );

  const activeQ =
    targetType === FREEZE_TARGET_BANK ? bankQ : targetType === FREEZE_TARGET_LP ? lpQ : pairQ;

  const rows = React.useMemo(
    () => toFreezeRows(targetType, activeQ.data?.data ?? []),
    [targetType, activeQ.data],
  );
  const paginationMeta = activeQ.data?.pagination;
  const isLoading = activeQ.isLoading;

  const onSearch = () => {
    setApplied({ keyword, status: statusFilter });
    setPageNum(1);
  };

  const onReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setApplied({ keyword: '', status: undefined });
    setPageNum(1);
  };

  const onTabChange = (value: string) => {
    setTargetType(Number(value));
    setPageNum(1);
  };

  /** 冻结/解冻切换（立即生效，不走审批；源 api/freeze.ts freezeToggle）。 */
  const onToggle = React.useCallback(
    (row: FreezeListRow) => {
      const willFreeze = row.status === FREEZE_STATUS_ACTIVE;
      const typeLabel = FREEZE_TARGET_TYPE_LABEL[row.targetType] ?? 'Target';
      const action = willFreeze ? 'freeze' : 'unfreeze';
      if (
        !window.confirm(
          `Are you sure you want to ${action} ${typeLabel} "${row.name}"?\n${willFreeze ? 'Once frozen, it can no longer participate in transactions.' : 'Once unfrozen, it will resume participating in transactions.'}`,
        )
      )
        return;
      toggleMutation.mutate(
        { targetType: row.targetType, targetId: row.targetId, freeze: willFreeze },
        {
          onSuccess: () => toast.success(willFreeze ? 'Frozen' : 'Unfrozen'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [toggleMutation, toast],
  );

  const onView = React.useCallback(
    (row: FreezeListRow) =>
      router.push(
        `/freeze/detail?id=${row.targetId}&type=${row.targetType}`,
      ),
    [router],
  );

  const columns = React.useMemo<ColumnDef<FreezeListRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => <span>{row.original.name || '--'}</span>,
      },
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => <span>{row.original.code || '--'}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={freezeStatusVariant(row.original.status)}>
            {FREEZE_STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original;
          const canToggle = isFreezable(item.status);
          const willFreeze = item.status === FREEZE_STATUS_ACTIVE;
          return (
            <div className="flex flex-wrap items-center gap-2">
              {canToggle && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  disabled={toggleMutation.isPending}
                  onClick={() => onToggle(item)}
                >
                  {willFreeze ? 'Freeze' : 'Unfreeze'}
                </Button>
              )}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => onView(item)}
              >
                Details
              </Button>
            </div>
          );
        },
      },
    ],
    [onToggle, onView, toggleMutation.isPending],
  );

  return (
    <div className="space-y-4">
      <Tabs value={String(targetType)} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value={String(FREEZE_TARGET_BANK)}>Bank</TabsTrigger>
          <TabsTrigger value={String(FREEZE_TARGET_LP)}>LP</TabsTrigger>
          <TabsTrigger value={String(FREEZE_TARGET_PAIR)}>Currency Pair</TabsTrigger>
        </TabsList>
        <TabsContent value={String(targetType)} className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch();
            }}
            className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
          >
            <div className="mb-4 text-sm font-semibold">Search</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  {targetType === FREEZE_TARGET_PAIR ? 'Source Currency' : 'Name'}
                </label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={targetType === FREEZE_TARGET_PAIR ? 'Search by source currency' : 'Enter name'}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Select
                  value={statusFilter === undefined ? STATUS_ALL : String(statusFilter)}
                  onValueChange={(v) =>
                    setStatusFilter(v === STATUS_ALL ? undefined : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>All</SelectItem>
                    <SelectItem value={String(FREEZE_STATUS_ACTIVE)}>Enabled</SelectItem>
                    <SelectItem value={String(FREEZE_STATUS_FROZEN)}>Frozen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </form>

          <div className="rounded-lg border-border/60 bg-card shadow-float">
            <div className="border-b border-border/50 px-6 py-3 text-sm font-semibold">
              Freeze Management — {FREEZE_TARGET_TYPE_LABEL[targetType] ?? ''}
            </div>
            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              emptyMessage="No data"
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: setPageNum,
                    }
                  : undefined
              }
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function FreezeDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const toggleMutation = useFreezeToggleMutation(KISSEN_PROJECT_ID);

  const targetId = parsePositiveInt(searchParams.get('id'));
  const rawType = parseIntOrNull(searchParams.get('type'));
  const targetType =
    rawType === FREEZE_TARGET_LP || rawType === FREEZE_TARGET_PAIR
      ? rawType
      : FREEZE_TARGET_BANK;

  // 源无 freeze 详情端点：拉取对应目标列表（大页）后按 id 定位（迁移偏差，见 yield）。
  const DETAIL_LOOKUP_SIZE = 100;
  const bankQ = useFreezeBankListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: DETAIL_LOOKUP_SIZE, filter: {} },
    targetType === FREEZE_TARGET_BANK && !!targetId,
  );
  const lpQ = useFreezeLpListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: DETAIL_LOOKUP_SIZE, filter: {} },
    targetType === FREEZE_TARGET_LP && !!targetId,
  );
  const pairQ = useFreezePairListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: DETAIL_LOOKUP_SIZE, filter: {} },
    targetType === FREEZE_TARGET_PAIR && !!targetId,
  );
  const activeQ =
    targetType === FREEZE_TARGET_BANK ? bankQ : targetType === FREEZE_TARGET_LP ? lpQ : pairQ;

  const target = React.useMemo(() => {
    const found = toFreezeRows(targetType, activeQ.data?.data ?? []).find(
      (r) => r.targetId === targetId,
    );
    return found;
  }, [targetType, activeQ.data, targetId]);

  if (!targetId) {
    return (
      <DetailCard title="Freeze Details">
        <p className="text-sm text-muted-foreground">Missing target ID.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/freeze')}>
          Back
        </Button>
      </DetailCard>
    );
  }

  const onToggle = () => {
    if (!target) return;
    const willFreeze = target.status === FREEZE_STATUS_ACTIVE;
    const typeLabel = FREEZE_TARGET_TYPE_LABEL[target.targetType] ?? 'Target';
    if (
      !window.confirm(
        `Are you sure you want to ${willFreeze ? 'freeze' : 'unfreeze'} ${typeLabel} "${target.name}"?`,
      )
    )
      return;
    toggleMutation.mutate(
      { targetType: target.targetType, targetId: target.targetId, freeze: willFreeze },
      {
        onSuccess: () => toast.success(willFreeze ? 'Frozen' : 'Unfrozen'),
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <DetailCard title="Freeze Details">
        {activeQ.isLoading || !activeQ.data ? (
          <LoadingBlock />
        ) : !target ? (
          <p className="text-sm text-muted-foreground">
            Target not found (it may be beyond the first {DETAIL_LOOKUP_SIZE} records).
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField label="Target Type">
                {FREEZE_TARGET_TYPE_LABEL[target.targetType] ?? target.targetType}
              </DetailField>
              <DetailField label="Target ID">{target.targetId}</DetailField>
              <DetailField label="Name">{target.name || '--'}</DetailField>
              <DetailField label="Code">{target.code || '--'}</DetailField>
              <DetailField label="Status">
                <Badge variant={freezeStatusVariant(target.status)}>
                  {FREEZE_STATUS_LABEL[target.status] ?? target.status}
                </Badge>
              </DetailField>
            </div>
            {isFreezable(target.status) && (
              <div className="mt-6 flex gap-2">
                <Button
                  disabled={toggleMutation.isPending}
                  onClick={onToggle}
                  variant={target.status === FREEZE_STATUS_ACTIVE ? 'destructive' : 'default'}
                >
                  {target.status === FREEZE_STATUS_ACTIVE ? 'Freeze' : 'Unfreeze'}
                </Button>
              </div>
            )}
          </>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/freeze')}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* monitor-hit — 监控命中                                          */
/* ============================================================ */

interface MonitorHitFilterForm {
  ruleCode: string;
  transactionId: string;
}

const EMPTY_HIT_FILTER: MonitorHitFilterForm = { ruleCode: '', transactionId: '' };

export function MonitorHitListPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<MonitorHitFilterForm>(EMPTY_HIT_FILTER);
  const [applied, setApplied] = React.useState<MonitorHitFilterForm>(EMPTY_HIT_FILTER);
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const txIdNum = applied.transactionId ? Number(applied.transactionId) : undefined;
  // 源 el-input-number :min=1 — 0/负数视为未填，不传给 query。
  const filter = {
    ruleCode: applied.ruleCode || undefined,
    transactionId:
      txIdNum !== undefined && Number.isFinite(txIdNum) && txIdNum > 0
        ? txIdNum
        : undefined,
  };

  const { data, isLoading } = useMonitorHitListQuery(KISSEN_PROJECT_ID, {
    pageNum,
    pageSize,
    filter,
  });

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.hitId) })),
    [rows],
  );

  const columns = React.useMemo<ColumnDef<MonitorHitRow & { id: string }>[]>(
    () => [
      {
        id: 'hitId',
        header: 'Hit ID',
        cell: ({ row }) => <span>{row.original.hitId}</span>,
      },
      {
        id: 'transactionId',
        header: 'Transaction ID',
        cell: ({ row }) => <span>{row.original.transactionId}</span>,
      },
      {
        accessorKey: 'ruleCode',
        header: 'Hit Rule',
        cell: ({ row }) => (
          <span>{RULE_CODE_MAP[row.original.ruleCode] ?? row.original.ruleCode}</span>
        ),
      },
      {
        accessorKey: 'hitDesc',
        header: 'Hit Description',
        cell: ({ row }) => <span>{row.original.hitDesc || '--'}</span>,
      },
      {
        accessorKey: 'handleStatus',
        header: 'Handling Status',
        cell: ({ row }) => (
          <Badge variant={handleStatusVariant(row.original.handleStatus)}>
            {HANDLE_STATUS_MAP[row.original.handleStatus] ?? row.original.handleStatus}
          </Badge>
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Hit Time',
        cell: ({ row }) => <span>{formatTimestamp(row.original.createTime)}</span>,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => router.push(`/monitor-hit/detail?id=${row.original.hitId}`)}
          >
            Details
          </Button>
        ),
      },
    ],
    [router],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(form);
          setPageNum(1);
        }}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Hit Rule</label>
            <Input
              value={form.ruleCode}
              onChange={(e) => setForm((f) => ({ ...f, ruleCode: e.target.value }))}
              placeholder="Rule code, e.g. HIGH_FREQ_SMALL"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
            <Input
              value={form.transactionId}
              onChange={(e) => setForm((f) => ({ ...f, transactionId: e.target.value }))}
              placeholder="Enter transaction ID"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setForm(EMPTY_HIT_FILTER);
              setApplied(EMPTY_HIT_FILTER);
              setPageNum(1);
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="border-b border-border/50 px-6 py-3 text-sm font-semibold">Monitor Hits</div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: setPageNum,
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setPageNum(1);
                  },
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

export function MonitorHitDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hitId = parsePositiveInt(searchParams.get('id'));

  // 源无 monitor-hit 详情端点：拉取列表（大页）后按 hitId 定位（迁移偏差，见 yield）。
  const DETAIL_LOOKUP_SIZE = 200;
  const { data, isLoading } = useMonitorHitListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: DETAIL_LOOKUP_SIZE, filter: {} },
    !!hitId,
  );

  const target = React.useMemo(
    () => (data?.data ?? []).find((r) => r.hitId === hitId),
    [data, hitId],
  );

  if (!hitId) {
    return (
      <DetailCard title="Monitor Hit Details">
        <p className="text-sm text-muted-foreground">Missing hit ID.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/monitor-hit')}
        >
          Back
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="Monitor Hit Details">
        {isLoading || !data ? (
          <LoadingBlock />
        ) : !target ? (
          <p className="text-sm text-muted-foreground">
            Hit not found (it may be beyond the first {DETAIL_LOOKUP_SIZE} records).
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Hit ID">{target.hitId}</DetailField>
            <DetailField label="Transaction ID">{target.transactionId}</DetailField>
            <DetailField label="Hit Rule">
              {RULE_CODE_MAP[target.ruleCode] ?? target.ruleCode}
            </DetailField>
            <DetailField label="Handling Status">
              <Badge variant={handleStatusVariant(target.handleStatus)}>
                {HANDLE_STATUS_MAP[target.handleStatus] ?? target.handleStatus}
              </Badge>
            </DetailField>
            <DetailField label="Hit Description">{target.hitDesc || '--'}</DetailField>
            <DetailField label="Hit Time">{formatTimestamp(target.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/monitor-hit')}>
          Back
        </Button>
      </div>
    </div>
  );
}
