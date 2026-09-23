'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';

import {
  Alert,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BadgeProps,
} from '@myorg/shared/ui';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  CONNECTIVITY_STATUS_LABEL,
  CONNECTIVITY_STATUS_VARIANT,
  CS_TYPE_LABEL,
  INSTANCE_STATUS_LABEL,
  INSTANCE_STATUS_VARIANT,
  KISSEN_PROJECT_ID,
  useInstanceHeartbeatQuery,
  useInstanceListQuery,
  type HeartbeatRow,
  type InstanceRow,
} from '@myorg/modules/kissen-admin/data-access';

import { peekRow } from './row-stash';

const INSTANCE_LIST_PATH = '/onboard/instance';
const INSTANCE_ROW_STASH_SCOPE = 'gateway-instance';
const DETAIL_FALLBACK_PAGE_SIZE = 200;
const HEARTBEAT_PAGE_SIZE = 10;
const ACTIVE_STATUS_CODE = 20;
const ONLINE_CONNECTIVITY_CODE = 1;

function parseInstanceId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const date = new Date(Number(ms));
  return Number.isNaN(date.getTime()) ? '--' : formatAdminDateTime(date);
}

/** Maps a Badge variant to a solid dot color so status reads at a glance. */
function statusDotClass(variant: BadgeProps['variant']): string {
  switch (variant) {
    case 'default':
      return 'bg-primary';
    case 'destructive':
      return 'bg-destructive';
    case 'warning':
      return 'bg-warning';
    case 'success':
      return 'bg-success';
    case 'info':
      return 'bg-info';
    default:
      return 'bg-muted-foreground';
  }
}

function StatusPill({
  label,
  variant,
  live = false,
}: {
  label: string;
  variant: BadgeProps['variant'];
  live?: boolean;
}) {
  const dotClass = statusDotClass(variant);
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
      <span className="relative flex size-2 shrink-0">
        {live ? (
          <span
            aria-hidden="true"
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${dotClass}`}
          />
        ) : null}
        <span
          aria-hidden="true"
          className={`relative inline-flex size-2 rounded-full ${dotClass}`}
        />
      </span>
      {label}
    </span>
  );
}

/** Label-on-top / value-below field. `span` widens it across the grid. */
function Field({
  label,
  children,
  mono = false,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  span?: 1 | 2 | 4;
}) {
  const spanClass =
    span === 4
      ? 'sm:col-span-2 lg:col-span-4'
      : span === 2
        ? 'sm:col-span-2'
        : '';
  return (
    <div className={`min-w-0 ${spanClass}`}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-sm leading-6 text-foreground ${
          mono ? 'break-all font-mono text-[13px]' : ''
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

/** Monospace fingerprint chip, or a muted fallback when absent. */
function Fingerprint({
  value,
  fallback,
}: {
  value: string | null | undefined;
  fallback: string;
}) {
  if (!value) return <span className="text-muted-foreground">{fallback}</span>;
  return (
    <span className="inline-block max-w-full break-all rounded-md bg-muted px-2 py-1 font-mono text-[13px] text-foreground">
      {value}
    </span>
  );
}

type HeartbeatRowWithId = HeartbeatRow & { id: string };

function HeartbeatResultBadge({ ok, detail }: { ok: number; detail?: string }) {
  const isTimeout = ok === 2 || /timeout/i.test(detail ?? '');
  if (ok === 1) return <Badge variant="default">Success</Badge>;
  if (isTimeout) return <Badge variant="warning">Timeout</Badge>;
  return <Badge variant="destructive">Failed</Badge>;
}

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

  const columns = React.useMemo<ColumnDef<HeartbeatRowWithId>[]>(
    () => [
      {
        accessorKey: 'probeTime',
        header: 'Time',
        cell: ({ row }) => <span>{formatTime(row.original.probeTime)}</span>,
      },
      {
        accessorKey: 'ok',
        header: 'Result',
        cell: ({ row }) => (
          <HeartbeatResultBadge
            ok={row.original.ok}
            detail={row.original.detail}
          />
        ),
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <span>
            {row.original.mode === 'SIGNED'
              ? 'Signed probe'
              : row.original.mode === 'BARE'
                ? 'Bare probe'
                : '--'}
          </span>
        ),
      },
      {
        accessorKey: 'latencyMs',
        header: 'Latency',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {row.original.latencyMs}ms
          </span>
        ),
      },
      {
        accessorKey: 'detail',
        header: 'Detail',
        cell: ({ row }) => <span>{row.original.detail || '--'}</span>,
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
      emptyMessage="No data"
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
  const [activeTab, setActiveTab] = React.useState('details');

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

  const isActive = instance?.status === ACTIVE_STATUS_CODE;
  const isOnline = instance?.connectivityStatus === ONLINE_CONNECTIVITY_CODE;

  return (
    <div className="space-y-6">
      <Button
        variant="link"
        className="h-auto p-0 text-muted-foreground hover:text-foreground"
        onClick={() => router.push(INSTANCE_LIST_PATH)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        Back to list
      </Button>

      {/* Header: identity, live status, at-a-glance overview */}
      <Card>
        <CardHeader className="flex-col items-stretch gap-6 border-b border-border/50 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="truncate text-2xl font-semibold leading-8 tracking-tight text-foreground">
              {instance?.instanceName ||
                instance?.instanceCode ||
                `Gateway Instance ${instanceId}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {instance?.bankName || '--'}
              {instance?.bankBic ? ` (${instance.bankBic})` : ''}
              {instance?.instanceCode ? ` · ${instance.instanceCode}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
            {instance ? (
              <>
                <StatusPill
                  label={
                    INSTANCE_STATUS_LABEL[instance.status] ?? instance.status
                  }
                  variant={INSTANCE_STATUS_VARIANT[instance.status] ?? 'outline'}
                  live={isActive}
                />
                <StatusPill
                  label={
                    CONNECTIVITY_STATUS_LABEL[instance.connectivityStatus] ??
                    'Unknown'
                  }
                  variant={
                    CONNECTIVITY_STATUS_VARIANT[
                      instance.connectivityStatus
                    ] ?? 'secondary'
                  }
                  live={isOnline}
                />
              </>
            ) : fallbackQuery.isLoading ? (
              <Skeleton className="h-5 w-44" />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {instance ? (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <Field label="Instance ID" mono>
                {instance.instanceId}
              </Field>
              <Field label="Last Heartbeat">
                {formatTime(instance.lastHeartbeatTime)}
              </Field>
              <Field label="Last Verify">
                {formatTime(instance.lastVerifyTime)}
              </Field>
              <Field label="Registered At">
                {formatTime(instance.createTime)}
              </Field>
            </dl>
          ) : fallbackQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="heartbeat">Heartbeat History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0 space-y-6">
          {fallbackQuery.isLoading && !instance ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : null}
          {fallbackQuery.isError && !instance ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load gateway instance details.</AlertTitle>
            </Alert>
          ) : null}
          {!fallbackQuery.isLoading && !fallbackQuery.isError && !instance ? (
            <p className="text-sm text-muted-foreground">
              Gateway instance not found.
            </p>
          ) : null}

          {instance ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="border-b border-border/50 py-4">
                  <CardTitle>Identity & Connectivity</CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <Field label="Bank Name">{instance.bankName || '--'}</Field>
                    <Field label="Bank BIC" mono>
                      {instance.bankBic || '--'}
                    </Field>
                    <Field label="Instance Code">
                      {instance.instanceCode || '--'}
                    </Field>
                    <Field label="Instance Name">
                      {instance.instanceName || '--'}
                    </Field>
                    <Field label="Status">
                      <Badge
                        variant={
                          INSTANCE_STATUS_VARIANT[instance.status] ?? 'outline'
                        }
                      >
                        {INSTANCE_STATUS_LABEL[instance.status] ??
                          instance.status}
                      </Badge>
                    </Field>
                    <Field label="Connectivity">
                      <Badge
                        variant={
                          CONNECTIVITY_STATUS_VARIANT[
                            instance.connectivityStatus
                          ] ?? 'secondary'
                        }
                      >
                        {CONNECTIVITY_STATUS_LABEL[
                          instance.connectivityStatus
                        ] ?? 'Unknown'}
                      </Badge>
                    </Field>
                    <Field label="Endpoint URL" mono span={2}>
                      {instance.endpointUrl || '--'}
                    </Field>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/50 py-4">
                  <CardTitle>Currency System</CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <Field label="Type">
                      {CS_TYPE_LABEL[instance.currencySystemType ?? 0] ??
                        'Not specified'}
                    </Field>
                    <Field label="Blockchain">
                      {instance.blockchain || '--'}
                    </Field>
                    <Field label="Name">
                      {instance.currencySystemName || '--'}
                    </Field>
                    <Field label="URL" mono>
                      {instance.currencySystemUrl || '--'}
                    </Field>
                    <Field label="Description" span={2}>
                      {instance.currencySystemDesc || '--'}
                    </Field>
                  </dl>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="border-b border-border/50 py-4">
                  <CardTitle>Security</CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                    <Field label="Upstream Key Fingerprint">
                      <Fingerprint
                        value={instance.upKeyFingerprint}
                        fallback="Not pushed"
                      />
                    </Field>
                    <Field label="Downstream Key Fingerprint">
                      <Fingerprint
                        value={instance.downKeyFingerprint}
                        fallback="Not generated"
                      />
                    </Field>
                  </dl>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="heartbeat" className="mt-0">
          <Card>
            <CardContent className="pt-6">
              <HeartbeatHistoryTab
                instanceId={instanceId}
                enabled={activeTab === 'heartbeat'}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
