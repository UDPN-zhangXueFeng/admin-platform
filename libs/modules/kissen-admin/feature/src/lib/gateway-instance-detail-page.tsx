'use client';

/*
 * 网关实例详情页（GatewayInstanceDetailPage）。
 *
 * 原型真源：/tmp/kissen_prototype/udpn-kissen-network-mgt/client/src/pages/
 * GatewayInstanceDetailsPage.jsx（行为规格：文案 / 列 / Tab 逐字对齐，UI 用本仓体系重实现）。
 *
 * 结构（原型 D10 页签骨架 + §3.15 单层页头）：
 *  - 页头：Back + 'Instance Details' + 实例状态徽章 + meta
 *    `Bank: X (BIC) | Instance ID: X | Registered on: X` + 右上三动作
 *    Verify Connectivity（Active 禁）/ Reset Key（Disabled 禁）/ Heartbeat（开抽屉）。
 *  - Tabs：basic / connectivity('Connectivity & Keys') / heartbeat('Heartbeat History',
 *    count) / operations('Operation History')，?tab= 写 URL（basic 缺省不占 query）。
 *  - basic = 'Instance Information' + 'Currency System'（合并值）+ 'Associated Tokens'
 *    （本实例所属银行的 token 列表）；connectivity = 'Keys & Connectivity' 字段集；
 *    heartbeat = 心跳记录表（与 Heartbeat 抽屉同数据源）；operations = 静态空表
 *    （GAP-ADM-02，operate-log 无按对象过滤 API）。
 *
 * 已登记偏差：
 *  - Service URL：InstanceRow 无该字段 → Dash（STATIC-FILLER GAP-ADM-08）。
 *  - 弹窗圆色：原型 Reset Key 为 warning 圆 + 主按钮；ActionConfirmDialog 仅
 *    confirm/destructive 两档，按全站收窄口径映射 confirm（同 token-manage-pages）。
 *  - stash 行兜底沿用旧实现（列表页 stashRow 预取，直跳 URL 时降级列表查询）。
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Coins,
  Hash,
  KeyRound,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';

import {
  Alert,
  AlertTitle,
  Button,
  DataTable,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  gatewayInstanceKeys,
  KISSEN_PROJECT_ID,
  useInstanceHeartbeatQuery,
  useInstanceListQuery,
  useInstanceResetKeyMutation,
  useInstanceVerifyMutation,
  useTokenListQuery,
  type HeartbeatRow,
  type InstanceRow,
  type TokenRow,
} from '@myorg/modules/kissen-admin/data-access';

import { peekRow } from './row-stash';
import { ActionConfirmDialog, CopyableId, Dash } from './proto-ui';
import { formatUtc8 } from './proto-format';
import {
  ConnectivityBadge,
  HeartbeatHistoryDrawer,
  HeartbeatResultBadge,
  INSTANCE_DIALOG_COPY,
  InstanceStatusBadge,
  TokenStatusBadge,
  type InstanceActionKind,
} from './token-manage-pages';

const INSTANCE_LIST_PATH = '/onboard/instance';
const INSTANCE_DETAIL_PATH = '/onboard/instance/detail';
const INSTANCE_ROW_STASH_SCOPE = 'gateway-instance';
const DETAIL_FALLBACK_PAGE_SIZE = 200;
const HEARTBEAT_PAGE_SIZE = 10;
const ACTIVE_STATUS_CODE = 20;
const DISABLED_STATUS_CODE = 50;

/**
 * Operation History 静态列契约（STATIC-FILLER GAP-ADM-02：operate-log 无按对象
 * （instanceId）过滤 API，先落列契约 + 空表，后端补齐后接真数据）。
 */
const OPERATION_COLUMNS: ColumnDef<{ id: string }>[] = [
  { id: 'timestamp', header: 'Timestamp (UTC+8)' },
  { id: 'operator', header: 'Operator' },
  { id: 'module', header: 'Module' },
  { id: 'status', header: 'Status' },
  { id: 'traceId', header: 'Trace ID' },
];

function parseInstanceId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** 实例显示 ID：优先 instanceCode（原型 Instance ID 列同口径）。 */
function instanceDisplayId(instance: InstanceRow): string {
  return instance.instanceCode || String(instance.instanceId);
}

/** Label-on-top / value-below field. `span` widens it across the grid. */
function Field({
  label,
  children,
  mono = false,
  span = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  span?: boolean;
}) {
  return (
    <div className={`min-w-0 ${span ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1.5 break-all text-sm leading-6 text-foreground ${
          mono ? 'font-mono text-[13px]' : ''
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

/** 卡片分区头（图标 + 标题，口径同 bank-onboard-pages）。 */
function SectionHeader({
  icon: Icon,
  title,
  aside,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-6 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {aside}
    </div>
  );
}

/** 详情 Tab 值（?tab= 写 URL；basic 缺省不占 query）。 */
type InstanceDetailTab =
  | 'basic'
  | 'connectivity'
  | 'heartbeat'
  | 'operations';

/** 心跳记录表（原型 heartbeat Tab：Time (UTC+8) / Result / Mode / Latency / Detail）。 */
function HeartbeatHistoryTab({
  instanceId,
  enabled,
}: {
  instanceId: number;
  enabled: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const query = useInstanceHeartbeatQuery(
    KISSEN_PROJECT_ID,
    instanceId,
    page,
    HEARTBEAT_PAGE_SIZE,
    enabled,
  );
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  const columns = React.useMemo<ColumnDef<HeartbeatRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'probeTime',
        header: 'Time (UTC+8)',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.probeTime)}
          </span>
        ),
      },
      {
        accessorKey: 'ok',
        header: 'Result',
        cell: ({ row }) => <HeartbeatResultBadge ok={row.original.ok} />,
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.mode || <Dash />}</span>
        ),
      },
      {
        accessorKey: 'latencyMs',
        header: 'Latency',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.latencyMs}ms
          </span>
        ),
      },
      {
        accessorKey: 'detail',
        header: 'Detail',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.detail || <Dash />}
          </span>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((row) => ({ ...row, id: String(row.logId) })),
    [rows],
  );

  if (query.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Failed to load heartbeat history.</AlertTitle>
      </Alert>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={tableData}
      isLoading={query.isLoading}
      emptyMessage="No heartbeat records found."
      pagination={{
        page,
        pageSize: HEARTBEAT_PAGE_SIZE,
        total,
        onPageChange: setPage,
      }}
    />
  );
}

export function GatewayInstanceDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const instanceId = parseInstanceId(searchParams.get('id'));

  // Tab 状态写 URL（原型同款：basic 缺省不占 query，刷新/分享/后退保持）。
  const tabParam = searchParams.get('tab');
  const activeTab: InstanceDetailTab =
    tabParam === 'connectivity' ||
    tabParam === 'heartbeat' ||
    tabParam === 'operations'
      ? tabParam
      : 'basic';
  const handleTabChange = (next: string) => {
    const params = new URLSearchParams();
    if (instanceId != null) params.set('id', String(instanceId));
    if (next !== 'basic') params.set('tab', next);
    router.replace(`${INSTANCE_DETAIL_PATH}?${params.toString()}`, {
      scroll: false,
    });
  };

  const toast = useToast();
  const queryClient = useQueryClient();
  const verifyMutation = useInstanceVerifyMutation(KISSEN_PROJECT_ID);
  const resetKeyMutation = useInstanceResetKeyMutation(KISSEN_PROJECT_ID);
  /** 动作弹窗（verify / resetKey，文案表 INSTANCE_DIALOG_COPY）。 */
  const [actionKind, setActionKind] = React.useState<InstanceActionKind | null>(
    null,
  );
  /** 页头 Heartbeat 按钮打开的抽屉（原型：开抽屉，非跳页签）。 */
  const [heartbeatOpen, setHeartbeatOpen] = React.useState(false);

  const stashedInstance = React.useMemo(
    () =>
      instanceId === undefined
        ? null
        : peekRow<InstanceRow>(INSTANCE_ROW_STASH_SCOPE, instanceId),
    [instanceId],
  );
  const hasStashedInstance = stashedInstance?.instanceId === instanceId;
  const fallbackQuery = useInstanceListQuery(
    KISSEN_PROJECT_ID,
    {
      pageNum: 1,
      pageSize: DETAIL_FALLBACK_PAGE_SIZE,
      filter: {},
    },
    instanceId !== undefined && !hasStashedInstance,
  );
  const instance = hasStashedInstance
    ? stashedInstance
    : fallbackQuery.data?.data.find((row) => row.instanceId === instanceId);

  // Associated Tokens：原型按 bankCode 关联本实例所属银行的 token；本仓 token
  // 列表按 bankId 过滤（常驻加载：分区计数需要行数）。
  const tokensQuery = useTokenListQuery(
    KISSEN_PROJECT_ID,
    { bankId: instance?.bankId ?? 0 },
    instance != null,
  );

  // 心跳计数（页签 count；与 HeartbeatHistoryTab 的 page=1 查询同 key，自动去重）。
  const heartbeatCountQuery = useInstanceHeartbeatQuery(
    KISSEN_PROJECT_ID,
    instanceId ?? 0,
    1,
    HEARTBEAT_PAGE_SIZE,
    instance != null,
  );

  if (instanceId === undefined) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <p className="text-sm text-muted-foreground">Missing instance ID.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(INSTANCE_LIST_PATH)}
        >
          Back to list
        </Button>
      </div>
    );
  }

  if (!instance && !fallbackQuery.isLoading && !fallbackQuery.isError) {
    // 原型 EmptyState 口径。
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          Gateway instance not found
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The record may have been removed. Go back to the list.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.push(INSTANCE_LIST_PATH)}
        >
          Back to list
        </Button>
      </div>
    );
  }

  const tokens = (tokensQuery.data ?? []).map((row: TokenRow) => ({
    ...row,
    id: String(row.tokenId),
  }));
  const heartbeatTotal = heartbeatCountQuery.data?.total ?? 0;

  /** Associated Tokens 列（原型 D10：本银行 token 列表列集）。 */
  const tokenColumns = React.useMemo<ColumnDef<TokenRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'tokenName',
        header: 'Token Name',
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.tokenName || <Dash />}
          </span>
        ),
      },
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.symbol || <Dash />}</span>
        ),
      },
      {
        accessorKey: 'anchorFiat',
        header: 'Pegged Currency',
        cell: ({ row }) => row.original.anchorFiat || <Dash />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <TokenStatusBadge
            status={row.original.status}
            rejectReason={row.original.rejectReason}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Registered on (UTC+8)',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
    ],
    [],
  );

  /** 弹窗确认（verify/resetKey），成功 toast 回显下游公钥指纹（列表页同口径）。 */
  const onActionConfirm = () => {
    if (!actionKind || !instance) return;
    const onError = (e: unknown) => toast.error((e as Error).message);
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: gatewayInstanceKeys.lists(KISSEN_PROJECT_ID),
      });
    };
    if (actionKind === 'verify') {
      verifyMutation.mutate(instance.instanceId, {
        onSuccess: (res) => {
          toast.success(
            `Instance activated (downstream key fingerprint ${
              res.downKeyFingerprint || '-'
            })`,
          );
          setActionKind(null);
          refresh();
        },
        onError,
      });
      return;
    }
    resetKeyMutation.mutate(instance.instanceId, {
      onSuccess: (res) => {
        toast.success(
          `Reset (new fingerprint ${res.downKeyFingerprint || '-'})`,
        );
        setActionKind(null);
        refresh();
      },
      onError,
    });
  };

  const dialogCopy = actionKind ? INSTANCE_DIALOG_COPY[actionKind] : null;

  const header = instance ? (
    <div className="flex flex-wrap items-start gap-3">
      <Button
        variant="outline"
        size="iconSm"
        aria-label="Back to instance list"
        onClick={() => router.push(INSTANCE_LIST_PATH)}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Instance Details</h1>
          <InstanceStatusBadge status={instance.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            Bank:{' '}
            <span className="font-semibold text-foreground">
              {instance.bankName || <Dash />}
              {instance.bankBic ? ` (${instance.bankBic})` : ''}
            </span>
          </span>
          <span aria-hidden="true">|</span>
          <span className="flex items-center gap-1">
            Instance ID:{' '}
            <span className="font-mono font-semibold text-foreground">
              {instanceDisplayId(instance)}
            </span>
          </span>
          <span aria-hidden="true">|</span>
          <span className="tabular-nums">
            Registered on {formatUtc8(instance.createTime)}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {/* 原型 D9：Active 后不可再验证；Disabled 不可重置密钥。 */}
        <Button
          variant="outline"
          size="sm"
          disabled={instance.status === ACTIVE_STATUS_CODE}
          onClick={() => setActionKind('verify')}
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          Verify Connectivity
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={instance.status === DISABLED_STATUS_CODE}
          onClick={() => setActionKind('resetKey')}
        >
          <KeyRound className="size-4" aria-hidden="true" />
          Reset Key
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHeartbeatOpen(true)}
        >
          <Activity className="size-4" aria-hidden="true" />
          Heartbeat
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-3">
      <Button
        variant="outline"
        size="iconSm"
        aria-label="Back to instance list"
        onClick={() => router.push(INSTANCE_LIST_PATH)}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
      <h1 className="text-xl font-semibold">Instance Details</h1>
    </div>
  );

  return (
    <div className="space-y-4">
      {header}

      {fallbackQuery.isError && !instance ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Failed to load gateway instance details.</AlertTitle>
        </Alert>
      ) : null}

      {instance ? (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          {/* 页签条独立于 Card（原型门禁），带计数（basic/connectivity 非集合无计数）。 */}
          <TabsList>
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="connectivity">
              Connectivity &amp; Keys
            </TabsTrigger>
            <TabsTrigger value="heartbeat">
              Heartbeat History
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {heartbeatTotal}
              </span>
            </TabsTrigger>
            <TabsTrigger value="operations">Operation History</TabsTrigger>
          </TabsList>

          {/* Tab 1：basic = Instance Information + Currency System + Associated Tokens。 */}
          <TabsContent value="basic" className="mt-0">
            <section className="space-y-6">
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <SectionHeader icon={Hash} title="Instance Information" />
                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
                  <Field label="Instance ID" mono>
                    {instanceDisplayId(instance)}
                  </Field>
                  <Field label="Registered on">
                    <span className="tabular-nums">
                      {formatUtc8(instance.createTime)}
                    </span>
                  </Field>
                  <Field label="Endpoint" mono>
                    {instance.endpointUrl || <Dash />}
                  </Field>
                  {/* STATIC-FILLER(GAP-ADM-08): InstanceRow 无 serviceUrl 字段，
                      空值渲染 Dash 不编造。 */}
                  <Field label="Service URL" mono>
                    <Dash />
                  </Field>
                </dl>
              </div>

              {/* 分区二：Currency System（原型合并值 `Name · Blockchain · URL` 逐字照抄）。 */}
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <SectionHeader icon={Layers} title="Currency System" />
                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
                  <Field label="Currency System" mono span>
                    {[
                      instance.currencySystemName,
                      instance.blockchain,
                      instance.currencySystemUrl,
                    ]
                      .filter(Boolean)
                      .join(' · ') || <Dash />}
                  </Field>
                </dl>
              </div>

              {/* 分区三：Associated Tokens（本银行 token 列表，带计数）。 */}
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <SectionHeader
                  icon={Coins}
                  title="Associated Tokens"
                  aside={
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      {tokens.length}
                    </span>
                  }
                />
                {tokensQuery.isError ? (
                  <div className="p-6">
                    <Alert variant="destructive">
                      <AlertTitle>Failed to load tokens.</AlertTitle>
                    </Alert>
                  </div>
                ) : (
                  <DataTable
                    columns={tokenColumns}
                    data={tokens}
                    isLoading={tokensQuery.isLoading}
                    emptyMessage="No tokens registered for this bank."
                  />
                )}
              </div>
            </section>
          </TabsContent>

          {/* Tab 2：Connectivity & Keys（字段集/顺序逐字保留原型 Keys & Connectivity）。 */}
          <TabsContent value="connectivity" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              <SectionHeader icon={KeyRound} title="Keys &amp; Connectivity" />
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
                <Field label="Upstream Public Key Fingerprint">
                  {instance.upKeyFingerprint ? (
                    <CopyableId value={instance.upKeyFingerprint} />
                  ) : (
                    <Dash />
                  )}
                </Field>
                <Field label="Downstream Public Key Fingerprint">
                  {instance.downKeyFingerprint ? (
                    <CopyableId value={instance.downKeyFingerprint} />
                  ) : (
                    <Dash />
                  )}
                </Field>
                <Field label="Connectivity">
                  <ConnectivityBadge status={instance.connectivityStatus} />
                </Field>
                <Field label="Last Heartbeat">
                  <span className="tabular-nums">
                    {formatUtc8(instance.lastHeartbeatTime)}
                  </span>
                </Field>
              </dl>
            </section>
          </TabsContent>

          {/* Tab 3：Heartbeat History（与抽屉同数据源）。 */}
          <TabsContent value="heartbeat" className="mt-0">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <HeartbeatHistoryTab
                instanceId={instanceId}
                enabled={activeTab === 'heartbeat'}
              />
            </section>
          </TabsContent>

          {/* Tab 4：Operation History —— 静态空表（GAP-ADM-02）。 */}
          <TabsContent value="operations" className="mt-0">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {/* STATIC-FILLER(GAP-ADM-02): operate-log 无按对象（instanceId）过滤
                  API，静态空表 + 列契约。 */}
              <DataTable
                columns={OPERATION_COLUMNS}
                data={[] as { id: string }[]}
                emptyMessage="No operations recorded yet."
              />
            </section>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          {fallbackQuery.isError ? null : (
            <Skeleton className="h-10 w-64" />
          )}
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {/* 页头 Heartbeat 动作 → 右侧抽屉（复用列表页组件）。 */}
      {instance && heartbeatOpen ? (
        <HeartbeatHistoryDrawer
          instance={instance}
          onClose={() => setHeartbeatOpen(false)}
        />
      ) : null}

      {/* 动作确认弹窗（文案表 INSTANCE_DIALOG_COPY）。 */}
      <ActionConfirmDialog
        open={dialogCopy != null}
        onOpenChange={(open) => {
          if (!open) setActionKind(null);
        }}
        icon={dialogCopy?.icon}
        variant={dialogCopy?.variant}
        title={dialogCopy?.title ?? ''}
        body1={dialogCopy && instance ? dialogCopy.body1(instance) : ''}
        body2={dialogCopy?.body2 && instance ? dialogCopy.body2(instance) : undefined}
        confirmLabel={dialogCopy?.confirmLabel}
        loading={verifyMutation.isPending || resetKeyMutation.isPending}
        onConfirm={onActionConfirm}
      />
    </div>
  );
}
