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
  MockDetailPage,
  MockFormPage,
  MockListPage,
  type MockColumn,
  type MockField,
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

const PAGE_SIZE = 10;

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
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
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
    { pageNum, pageSize: PAGE_SIZE, filter: bankFilter },
    targetType === FREEZE_TARGET_BANK,
  );
  const lpQ = useFreezeLpListQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize: PAGE_SIZE, filter: lpFilter },
    targetType === FREEZE_TARGET_LP,
  );
  const pairQ = useFreezePairListQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize: PAGE_SIZE, filter: pairFilter },
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
      const typeLabel = FREEZE_TARGET_TYPE_LABEL[row.targetType] ?? '目标';
      const action = willFreeze ? '冻结' : '解冻';
      if (
        !window.confirm(
          `确认${action}${typeLabel}「${row.name}」?\n${willFreeze ? '冻结后将无法参与交易。' : '解冻后将恢复参与交易。'}`,
        )
      )
        return;
      toggleMutation.mutate(
        { targetType: row.targetType, targetId: row.targetId, freeze: willFreeze },
        {
          onSuccess: () => toast.success(`已${action}`),
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
        header: '名称',
        cell: ({ row }) => <span>{row.original.name || '--'}</span>,
      },
      {
        id: 'code',
        header: '编码',
        cell: ({ row }) => <span>{row.original.code || '--'}</span>,
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => (
          <Badge variant={freezeStatusVariant(row.original.status)}>
            {FREEZE_STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '操作',
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
                  {willFreeze ? '冻结' : '解冻'}
                </Button>
              )}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => onView(item)}
              >
                详情
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
          <TabsTrigger value={String(FREEZE_TARGET_BANK)}>银行</TabsTrigger>
          <TabsTrigger value={String(FREEZE_TARGET_LP)}>LP</TabsTrigger>
          <TabsTrigger value={String(FREEZE_TARGET_PAIR)}>货币对</TabsTrigger>
        </TabsList>
        <TabsContent value={String(targetType)} className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch();
            }}
            className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="mb-4 text-sm font-semibold">查询</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  {targetType === FREEZE_TARGET_PAIR ? '源币种' : '名称'}
                </label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={targetType === FREEZE_TARGET_PAIR ? '按源币种搜索' : '请输入名称'}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">状态</label>
                <Select
                  value={statusFilter === undefined ? STATUS_ALL : String(statusFilter)}
                  onValueChange={(v) =>
                    setStatusFilter(v === STATUS_ALL ? undefined : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>全部</SelectItem>
                    <SelectItem value={String(FREEZE_STATUS_ACTIVE)}>启用</SelectItem>
                    <SelectItem value={String(FREEZE_STATUS_FROZEN)}>冻结</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">查询</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                重置
              </Button>
            </div>
          </form>

          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              冻结管理 — {FREEZE_TARGET_TYPE_LABEL[targetType] ?? ''}
            </div>
            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              emptyMessage="暂无数据"
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
      <DetailCard title="冻结详情">
        <p className="text-sm text-muted-foreground">缺少目标 ID。</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/freeze')}>
          返回
        </Button>
      </DetailCard>
    );
  }

  const onToggle = () => {
    if (!target) return;
    const willFreeze = target.status === FREEZE_STATUS_ACTIVE;
    const typeLabel = FREEZE_TARGET_TYPE_LABEL[target.targetType] ?? '目标';
    if (!window.confirm(`确认${willFreeze ? '冻结' : '解冻'}${typeLabel}「${target.name}」?`))
      return;
    toggleMutation.mutate(
      { targetType: target.targetType, targetId: target.targetId, freeze: willFreeze },
      {
        onSuccess: () => toast.success(`已${willFreeze ? '冻结' : '解冻'}`),
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <DetailCard title="冻结详情">
        {activeQ.isLoading || !activeQ.data ? (
          <LoadingBlock />
        ) : !target ? (
          <p className="text-sm text-muted-foreground">
            未找到该目标（可能已不在前 {DETAIL_LOOKUP_SIZE} 条记录内）。
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField label="目标类型">
                {FREEZE_TARGET_TYPE_LABEL[target.targetType] ?? target.targetType}
              </DetailField>
              <DetailField label="目标 ID">{target.targetId}</DetailField>
              <DetailField label="名称">{target.name || '--'}</DetailField>
              <DetailField label="编码">{target.code || '--'}</DetailField>
              <DetailField label="状态">
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
                  {target.status === FREEZE_STATUS_ACTIVE ? '冻结' : '解冻'}
                </Button>
              </div>
            )}
          </>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/freeze')}>
          返回
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

  const txIdNum = applied.transactionId ? Number(applied.transactionId) : undefined;
  const filter = {
    ruleCode: applied.ruleCode || undefined,
    transactionId: Number.isFinite(txIdNum) ? txIdNum : undefined,
  };

  const { data, isLoading } = useMonitorHitListQuery(KISSEN_PROJECT_ID, {
    pageNum,
    pageSize: PAGE_SIZE,
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
        header: '命中 ID',
        cell: ({ row }) => <span>{row.original.hitId}</span>,
      },
      {
        id: 'transactionId',
        header: '交易 ID',
        cell: ({ row }) => <span>{row.original.transactionId}</span>,
      },
      {
        accessorKey: 'ruleCode',
        header: '命中规则',
        cell: ({ row }) => (
          <span>{RULE_CODE_MAP[row.original.ruleCode] ?? row.original.ruleCode}</span>
        ),
      },
      {
        accessorKey: 'hitDesc',
        header: '命中描述',
        cell: ({ row }) => <span>{row.original.hitDesc || '--'}</span>,
      },
      {
        accessorKey: 'handleStatus',
        header: '处理状态',
        cell: ({ row }) => (
          <Badge variant={handleStatusVariant(row.original.handleStatus)}>
            {HANDLE_STATUS_MAP[row.original.handleStatus] ?? row.original.handleStatus}
          </Badge>
        ),
      },
      {
        accessorKey: 'createTime',
        header: '命中时间',
        cell: ({ row }) => <span>{formatTimestamp(row.original.createTime)}</span>,
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => router.push(`/monitor-hit/detail?id=${row.original.hitId}`)}
          >
            详情
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">命中规则</label>
            <Input
              value={form.ruleCode}
              onChange={(e) => setForm((f) => ({ ...f, ruleCode: e.target.value }))}
              placeholder="规则编码，如 HIGH_FREQ_SMALL"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">交易 ID</label>
            <Input
              value={form.transactionId}
              onChange={(e) => setForm((f) => ({ ...f, transactionId: e.target.value }))}
              placeholder="请输入交易 ID"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">查询</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setForm(EMPTY_HIT_FILTER);
              setApplied(EMPTY_HIT_FILTER);
              setPageNum(1);
            }}
          >
            重置
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">监控命中</div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="暂无数据"
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
      <DetailCard title="监控命中详情">
        <p className="text-sm text-muted-foreground">缺少命中 ID。</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/monitor-hit')}
        >
          返回
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="监控命中详情">
        {isLoading || !data ? (
          <LoadingBlock />
        ) : !target ? (
          <p className="text-sm text-muted-foreground">
            未找到该命中（可能已不在前 {DETAIL_LOOKUP_SIZE} 条记录内）。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="命中 ID">{target.hitId}</DetailField>
            <DetailField label="交易 ID">{target.transactionId}</DetailField>
            <DetailField label="命中规则">
              {RULE_CODE_MAP[target.ruleCode] ?? target.ruleCode}
            </DetailField>
            <DetailField label="处理状态">
              <Badge variant={handleStatusVariant(target.handleStatus)}>
                {HANDLE_STATUS_MAP[target.handleStatus] ?? target.handleStatus}
              </Badge>
            </DetailField>
            <DetailField label="命中描述">{target.hitDesc || '--'}</DetailField>
            <DetailField label="命中时间">{formatTimestamp(target.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/monitor-hit')}>
          返回
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* monitor-rule — 监控规则（源 rule CRUD 为 M14 定稿占位，保留 mock） */
/* ============================================================ */
// 无源功能，占位

const monitorRuleColumns: MockColumn[] = [
  { key: 'ruleId', label: '规则 ID' },
  { key: 'ruleName', label: '规则名称' },
  { key: 'ruleCode', label: '规则编码' },
  { key: 'riskLevel', label: '风险等级' },
  { key: 'status', label: '状态' },
];

const monitorRuleRows = [
  { id: '1', ruleId: 'R-001', ruleName: '高频小额', ruleCode: 'HIGH_FREQ_SMALL', riskLevel: '中', status: '启用' },
  { id: '2', ruleId: 'R-002', ruleName: '关联交易', ruleCode: 'SELF_TRANSFER', riskLevel: '高', status: '启用' },
  { id: '3', ruleId: 'R-003', ruleName: '异常金额', ruleCode: 'ABNORMAL_AMOUNT', riskLevel: '高', status: '启用' },
];

const monitorRuleFields: MockField[] = [
  { key: 'ruleId', label: '规则 ID' },
  { key: 'ruleName', label: '规则名称' },
  { key: 'ruleCode', label: '规则编码' },
  { key: 'riskLevel', label: '风险等级' },
  { key: 'threshold', label: '阈值' },
  { key: 'status', label: '状态' },
];

const monitorRuleData = {
  id: '1',
  ruleId: 'R-001',
  ruleName: '高频小额',
  ruleCode: 'HIGH_FREQ_SMALL',
  riskLevel: '中',
  threshold: '单笔 < 10 且 10 分钟内 ≥ 5 笔',
  status: '启用',
};

const monitorRuleFormFields: MockField[] = [
  { key: 'ruleName', label: '规则名称' },
  { key: 'ruleCode', label: '规则编码' },
  { key: 'riskLevel', label: '风险等级', type: 'select', options: ['低', '中', '高'] },
  { key: 'threshold', label: '阈值' },
  { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] },
];

export function MonitorRuleListPage() {
  return (
    <MockListPage title="监控规则" columns={monitorRuleColumns} rows={monitorRuleRows} />
  );
}

export function MonitorRuleDetailPage() {
  return (
    <MockDetailPage title="监控规则详情" fields={monitorRuleFields} data={monitorRuleData} />
  );
}

export function MonitorRuleFormPage() {
  return <MockFormPage title="监控规则编辑" fields={monitorRuleFormFields} />;
}
