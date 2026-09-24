'use client';

/**
 * Bank onboarding pages（registry module `bank`）：
 *   BankInfoListPage   → 列表（+ 内联 Access-Key / Interact 抽屉）
 *   BankInfoFormPage   → 登记/编辑页（源 bank-dialog create/edit）
 *   BankInfoDetailPage → 详情页（四 Tab：basic/instances/tokens/operations）
 *
 * 行为规格：KNMS 原型页（2026-09-23 P3 对齐）BankOnboardingPage / BankDetailsPage
 * ——列/筛选/动作菜单/确认弹窗/详情字段逐字对齐，UI 用本仓库组件体系重实现；
 * 文案真源 /tmp/kissen_prototype/udpn-kissen-network-mgt/client/src/pages/。
 * 历史口径：tokenized v2.0 rewrite（源 views/onboard/bank/：index.vue +
 * bank-dialog.vue + access-key-drawer.vue + interact-drawer.vue）。
 */

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CircleCheck,
  CirclePause,
  Coins,
  Copy,
  ExternalLink,
  Globe,
  Hash,
  Info,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  MoreVertical,
  Network,
  Phone,
  SlidersHorizontal,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  CopyableEllipsisText,
  createActionColumn,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { formatAdminDateTime } from '@myorg/shared/util-dates';

import {
  KEY_STATUS_LABEL,
  KISSEN_PROJECT_ID,
  REVOKE_REASON_LABEL,
  useAccessKeyGenerateMutation,
  useAccessKeyListQuery,
  useAccessKeyRevokeMutation,
  useBankDetailQuery,
  useBankDisableMutation,
  useBankEnableMutation,
  useBankListQuery,
  useInteractSaveMutation,
  useInteractViewQuery,
  useInstanceListQuery,
  useSaveBankMutation,
  useTokenListQuery,
  type AccessKeyGenerated,
  type AccessKeyRow,
  type BankListFilter,
  type BankRow,
  type BankSaveReq,
  type InstanceRow,
  type InteractPeerRow,
  type InteractTokenRow,
  type TokenRow,
} from '@myorg/modules/kissen-admin/data-access';

import {
  ActionConfirmDialog,
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoStatusTone,
  writeClipboard,
} from './proto-ui';
import { formatTokenAmount, formatUtc8 } from './proto-format';
import { PROTO_BANK_STATUS, protoStatusLabel } from './proto-enums';
import {
  ConnectivityBadge,
  InstanceStatusBadge,
  TokenStatusBadge,
} from './token-manage-pages';

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const STATUS_ALL = 'all';

/** 列表路由前缀：config.modules path `/onboard/bank`（group 路由）。 */
const LIST_PATH = '/onboard/bank';

/* ================================================================== */
/* 共用展示 helper                                                      */
/* ================================================================== */

/** 毫秒时间戳 → `Sep 2, 2026, 09:09:10 (UTC+8)`。 */
function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '--' : formatAdminDateTime(d);
}

function parseBankId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Compress an uploaded image to a 64×64 PNG data URI for the bank logo
 * (source 4685063: base has no file service, so the compressed data URI is
 * stored directly in the `logo` column, ~3-6KB). Contain-fit on a
 * transparent canvas.
 */
function resizeImageToDataUrl(file: File, size = 64): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas unavailable'));
        return;
      }
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('image load failed'));
  };
  img.src = url;
  return promise;
}

function safeExternalUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/** KNMS BankOnboardingPage D3：1 草稿/10 待入网/5 待审核/15 驳回/20 激活/50 停用。 */
const BANK_STATUS_TONES: Record<number, ProtoStatusTone> = {
  1: 'muted',
  5: 'warning',
  10: 'warning',
  15: 'danger',
  20: 'success',
  50: 'muted',
};

function BankStatusBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={BANK_STATUS_TONES[status] ?? 'muted'}>
      {protoStatusLabel(PROTO_BANK_STATUS, status)}
    </ProtoStatusBadge>
  );
}

/**
 * Operation History 静态列契约（STATIC-FILLER GAP-ADM-02：operate-log
 * 无按对象过滤 API，先落列契约 + 空表，后端补齐后接真数据）。
 */
const BANK_OPERATION_COLUMNS: ColumnDef<{ id: string }>[] = [
  { id: 'timestamp', header: 'Timestamp' },
  { id: 'operator', header: 'Operator' },
  { id: 'module', header: 'Module' },
  { id: 'status', header: 'Status' },
  { id: 'traceId', header: 'Trace ID' },
];

function DetailField({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium capitalize text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function BankDetailSectionHeader({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {aside}
    </header>
  );
}

/** 确认流（源 ElMessageBox.confirm → 共享 AlertDialog，约束禁 window.confirm）。 */
interface ConfirmRequest {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

function ConfirmAlertDialog({
  request,
  onDismiss,
}: {
  request: ConfirmRequest | null;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog
      open={request != null}
      onOpenChange={(open) => !open && onDismiss()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {request?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              request?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
            onClick={() => request?.onConfirm()}
          >
            {request?.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ================================================================== */
/* AccessKeyDrawer — 接入 Key 台账（源 access-key-drawer.vue，内联抽屉）  */
/* ================================================================== */

interface LedgerRow extends AccessKeyRow {
  id: string;
}

function AccessKeyDrawer({
  bank,
  onClose,
}: {
  bank: BankRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data, isLoading } = useAccessKeyListQuery(
    KISSEN_PROJECT_ID,
    bank.bankId,
  );
  const generateMutation = useAccessKeyGenerateMutation(KISSEN_PROJECT_ID);
  const revokeMutation = useAccessKeyRevokeMutation(KISSEN_PROJECT_ID);

  const [generateConfirm, setGenerateConfirm] = React.useState(false);
  const [generated, setGenerated] = React.useState<AccessKeyGenerated | null>(
    null,
  );
  const [revokeTarget, setRevokeTarget] = React.useState<LedgerRow | null>(
    null,
  );
  const [revokeReason, setRevokeReason] = React.useState('');
  const [revokeError, setRevokeError] = React.useState<string | null>(null);

  const rows = React.useMemo<LedgerRow[]>(
    () => (data ?? []).map((r) => ({ ...r, id: String(r.keyId) })),
    [data],
  );

  const onGenerate = React.useCallback(() => {
    generateMutation.mutate(bank.bankId, {
      onSuccess: (res) => {
        setGenerateConfirm(false);
        setGenerated(res);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  }, [bank.bankId, generateMutation, toast]);

  const onCopyKey = React.useCallback(() => {
    if (!generated) return;
    void writeClipboard(generated.accessKey).then((ok) => {
      if (ok) {
        toast.success('Copied');
      } else {
        toast.error('Copy failed. Please copy manually.');
      }
    });
  }, [generated, toast]);

  const openRevoke = React.useCallback((row: LedgerRow) => {
    setRevokeReason('');
    setRevokeError(null);
    setRevokeTarget(row);
  }, []);

  const onRevoke = React.useCallback(() => {
    if (!revokeTarget) return;
    const reason = revokeReason.trim();
    if (reason.length < 1 || reason.length > 200) {
      setRevokeError('Reason is required (1-200 characters).');
      return;
    }
    revokeMutation.mutate(
      { keyId: revokeTarget.keyId, reason },
      {
        onSuccess: () => {
          toast.success('Revoked');
          setRevokeTarget(null);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }, [revokeMutation, revokeReason, revokeTarget, toast]);

  const columns = React.useMemo<ColumnDef<LedgerRow, unknown>[]>(
    () => [
      { accessorKey: 'keyId', header: 'ID', meta: { overflow: 'none' } },
      {
        accessorKey: 'keyFingerprint',
        header: 'Fingerprint',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.keyFingerprint}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 20 ? 'default' : 'secondary'}>
            {KEY_STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'revokeReason',
        header: 'Revoke Reason',
        cell: ({ row }) => (
          <span>
            {REVOKE_REASON_LABEL[row.original.revokeReason ?? 0] ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'instanceId',
        header: 'Instance',
        cell: ({ row }) => (
          <span>
            {row.original.instanceId && row.original.instanceId > 0
              ? row.original.instanceId
              : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => <span>{formatTime(row.original.createTime)}</span>,
      },
      createActionColumn<LedgerRow>((item) =>
        item.status === 20
          ? [
              {
                label: 'Revoke',
                destructive: true,
                onClick: () => openRevoke(item),
              },
            ]
          : [],
      ),
    ],
    [openRevoke],
  );

  return (
    <>
      <Drawer open onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="w-[640px] max-w-none  sm:max-w-[640px]">
          <DrawerHeader>
            <DrawerTitle>
              Access Keys — {bank.bankName} ({bank.bankBic})
            </DrawerTitle>
            <DrawerDescription>
              The bootstrap auth pair is the bank BIC plus the access key.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-4">
            <Alert>
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
              <AlertTitle>Bootstrap authentication</AlertTitle>
              <AlertDescription>
                The access key is deployed as a gateway launch parameter and is
                auto-revoked when the bound instance activates. The plaintext is
                shown exactly once at generation time.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {rows.length} keys
              </span>
              <Button size="sm" onClick={() => setGenerateConfirm(true)}>
                Generate Access Key
              </Button>
            </div>

            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              emptyMessage="No access keys yet"
            />
          </div>

          <DrawerFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 生成确认（源 ElMessageBox.confirm）。 */}
      <ConfirmAlertDialog
        request={
          generateConfirm
            ? {
                title: 'Generate Access Key',
                description:
                  'The plaintext access key will be shown only once after generation. Copy it and deliver it offline immediately. Continue?',
                actionLabel: 'Generate',
                onConfirm: onGenerate,
              }
            : null
        }
        onDismiss={() => setGenerateConfirm(false)}
      />

      {/* 生成结果：一次性明文（源 access-key-result dialog）。 */}
      <Dialog
        open={generated != null}
        onOpenChange={(open) => !open && setGenerated(null)}
      >
        <DialogContent
          className="max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Access Key Generated</DialogTitle>
            <DialogDescription>
              Key #{generated?.keyId} for {bank.bankName} ({bank.bankBic})
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertTitle>The plaintext cannot be viewed again</AlertTitle>
            <AlertDescription>
              Once this dialog closes, only the fingerprint remains. Copy the
              key now and deliver it offline.
            </AlertDescription>
          </Alert>
          <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Access Key</div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 break-all font-mono text-sm">
                  {generated?.accessKey}
                </div>
                {/* 复制贴近字段（§6.3）：由页脚上移至字段旁，动作数不变 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={onCopyKey}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy Key
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Bank BIC</div>
              <div className="text-sm">
                {generated?.bankBic || bank.bankBic || '—'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Fingerprint</div>
              <div className="break-all font-mono text-sm">
                {generated?.keyFingerprint}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setGenerated(null)}>
              I have saved it, close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 作废：原因必填 1-200 字符（源 ElMessageBox.prompt → Dialog + Input）。 */}
      <Dialog
        open={revokeTarget != null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke Access Key</DialogTitle>
            <DialogDescription>
              Revoke key #{revokeTarget?.keyId}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reason
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <Input
              value={revokeReason}
              maxLength={200}
              placeholder="Why is this key being revoked?"
              onChange={(e) => {
                setRevokeReason(e.target.value);
                setRevokeError(null);
              }}
            />
            {revokeError && (
              <p className="text-sm text-destructive">{revokeError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={onRevoke}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ================================================================== */
/* InteractDrawer — Token 交互规则（源 interact-drawer.vue，内联抽屉）    */
/* ================================================================== */

/** Token display name: symbol abbreviation first, falling back to code (source dd0410a). */
function tokenLabel(token: InteractTokenRow): string {
  return token.symbol || token.tokenCode;
}

function InteractDrawer({
  bank,
  onClose,
}: {
  bank: BankRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data, isLoading } = useInteractViewQuery(
    KISSEN_PROJECT_ID,
    bank.bankId,
  );
  const saveMutation = useInteractSaveMutation(KISSEN_PROJECT_ID, bank.bankId);

  const peers = data?.peers ?? [];

  /** 行级开关待确认态（源 ElMessageBox.confirm → AlertDialog）。 */
  const [rowConfirm, setRowConfirm] = React.useState<{
    peer: InteractPeerRow;
    allow: boolean;
  } | null>(null);

  const peerName = React.useCallback(
    (peer: InteractPeerRow) => peer.bankName || peer.bankBic,
    [],
  );

  /** 行级开关（tokenId 缺省 = 整行；服务端会同时清除双方 token 级规则）。 */
  const onToggleWhole = React.useCallback(() => {
    if (!rowConfirm) return;
    const { peer, allow } = rowConfirm;
    saveMutation.mutate(
      { bankId: bank.bankId, peerBankId: peer.bankId, banned: !allow },
      {
        onSuccess: () => {
          setRowConfirm(null);
          toast.success(
            allow
              ? `Resumed interaction with ${peer.bankBic} (effective immediately)`
              : `Banned interaction with ${peer.bankBic} (effective immediately)`,
          );
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }, [bank.bankId, rowConfirm, saveMutation, toast]);

  /** Token 级芯片开关：无确认；成功即翻转（源点击即切，立即生效）。 */
  const onToggleToken = React.useCallback(
    (peer: InteractPeerRow, token: InteractTokenRow) => {
      const nextBanned = !token.banned;
      saveMutation.mutate(
        {
          bankId: bank.bankId,
          peerBankId: peer.bankId,
          tokenId: token.tokenId,
          banned: nextBanned,
        },
        {
          onSuccess: () => {
            toast.success(
              nextBanned
                ? `Banned ${peer.bankBic} · ${tokenLabel(token)} for this bank`
                : `Resumed interaction with ${peer.bankBic} · ${tokenLabel(token)}`,
            );
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [bank.bankId, saveMutation, toast],
  );

  return (
    <>
      <Drawer open onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="w-[740px] max-w-none sm:max-w-[740px]">
          <DrawerHeader>
            <DrawerTitle>
              Bank Interact Rules — {bank.bankName} ({bank.bankBic})
            </DrawerTitle>
            <DrawerDescription>
              Changes take effect on gateways immediately.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 pt-4">
            <Alert>
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <AlertTitle>Open by default </AlertTitle>
              <AlertDescription>
                This bank is connected to all onboarded banks and all their
                tokens. To customize, add a rule below.
              </AlertDescription>
            </Alert>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : peers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No other onboarded banks
              </p>
            ) : (
              peers.map((peer) => (
                <div
                  key={peer.bankId}
                  className={
                    peer.wholeBanned
                      ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-4'
                      : 'rounded-lg border border-border/60 bg-card p-4'
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {peerName(peer)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({peer.bankBic})
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {peer.wholeBanned ? 'Banned' : 'Allowed'}
                      </span>
                      <Switch
                        checked={!peer.wholeBanned}
                        disabled={saveMutation.isPending}
                        onCheckedChange={(checked) =>
                          setRowConfirm({ peer, allow: checked })
                        }
                      />
                    </div>
                  </div>

                  {!peer.wholeBanned && (
                    <div className="mt-3 border-t pt-3">
                      {peer.tokens?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {peer.tokens.map((token) => (
                            <button
                              key={token.tokenId}
                              type="button"
                              disabled={saveMutation.isPending}
                              title={`Click to ${token.banned ? 'resume' : 'ban'} interaction with ${peer.bankBic} · ${tokenLabel(token)}`}
                              onClick={() => onToggleToken(peer, token)}
                              className={
                                token.banned
                                  ? 'inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs motion-safe:transition-colors hover:bg-destructive/20'
                                  : 'inline-flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs motion-safe:transition-colors hover:bg-accent'
                              }
                            >
                              <span
                                className={`font-mono ${token.banned ? 'text-destructive line-through' : ''}`}
                              >
                                {tokenLabel(token)}
                              </span>
                              <span
                                className={
                                  token.banned
                                    ? 'text-destructive'
                                    : 'text-primary'
                                }
                              >
                                {token.banned ? 'Banned' : 'Allowed'}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No active tokens for this bank
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <DrawerFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 行级开关确认：恢复 / 禁止 方向相关文案（源一致）。 */}
      <ConfirmAlertDialog
        request={
          rowConfirm
            ? rowConfirm.allow
              ? {
                  title: 'Resume Interaction',
                  description: `Resume all interaction with ${peerName(rowConfirm.peer)}? Token-level bans under this pair will be cleared as well.`,
                  actionLabel: 'Confirm Resume',
                  onConfirm: onToggleWhole,
                }
              : {
                  title: 'Block Interaction',
                  description: `Block all interactions with ${peerName(rowConfirm.peer)}? The two banks will no longer participate in each other's transactions.`,
                  actionLabel: 'Confirm Ban',
                  destructive: true,
                  onConfirm: onToggleWhole,
                }
            : null
        }
        onDismiss={() => setRowConfirm(null)}
      />
    </>
  );
}

/* ================================================================== */
/* BankInfoListPage — 银行列表（源 onboard/bank/index.vue）              */
/* ================================================================== */

interface BankInfoFilterForm {
  bankName?: string;
  bankBic?: string;
  status?: string;
}

const EMPTY_BANK_FILTER: BankInfoFilterForm = {
  bankName: '',
  bankBic: '',
  status: STATUS_ALL,
};

function bankFormToParams(
  form: BankInfoFilterForm,
  pageNum: number,
  pageSize: number,
): { pageNum: number; pageSize: number; filter: BankListFilter } {
  const filter: BankListFilter = {};
  if (form.bankName) filter.bankName = form.bankName;
  if (form.bankBic) filter.bankBic = form.bankBic;
  if (form.status && form.status !== STATUS_ALL)
    filter.status = Number(form.status);
  return { pageNum, pageSize, filter };
}

export function BankInfoListPage() {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, reset, control } =
    useForm<BankInfoFilterForm>({
      defaultValues: EMPTY_BANK_FILTER,
    });
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [params, setParams] = React.useState(() =>
    bankFormToParams(EMPTY_BANK_FILTER, 1, PAGE_SIZE_DEFAULT),
  );

  const { data, isLoading, isError, dataUpdatedAt } = useBankListQuery(
    KISSEN_PROJECT_ID,
    params,
  );
  const disableMutation = useBankDisableMutation(KISSEN_PROJECT_ID);
  const enableMutation = useBankEnableMutation(KISSEN_PROJECT_ID);

  /** 内联抽屉（源 AccessKeyDrawer / InteractDrawer）。 */
  const [accessKeyBank, setAccessKeyBank] = React.useState<BankRow | null>(
    null,
  );
  const [interactBank, setInteractBank] = React.useState<BankRow | null>(null);
  /** Deactivate/Activate 确认弹窗态（原型 D11 ActionConfirmDialog 双段文案）。 */
  const [statusAction, setStatusAction] = React.useState<{
    row: BankRow;
    kind: 'deactivate' | 'activate';
  } | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSearch = React.useCallback(
    (form: BankInfoFilterForm) => {
      setParams(bankFormToParams(form, 1, pageSize));
    },
    [pageSize],
  );

  const onReset = React.useCallback(() => {
    reset(EMPTY_BANK_FILTER);
    setParams(bankFormToParams(EMPTY_BANK_FILTER, 1, pageSize));
  }, [reset, pageSize]);

  /** Deactivate/Activate 共用确认提交（原型 D11：destructive / confirm 两档弹窗）。 */
  const onStatusConfirm = () => {
    if (!statusAction) return;
    const { row, kind } = statusAction;
    const mutation = kind === 'deactivate' ? disableMutation : enableMutation;
    mutation.mutate(row.bankId, {
      onSuccess: () => {
        toast.success(kind === 'deactivate' ? 'Deactivated' : 'Activated');
        setStatusAction(null);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };


  const columns = React.useMemo<ColumnDef<BankRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'bankName',
        header: 'Bank Name',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            {row.original.logo ? (
              <img
                src={row.original.logo}
                alt=""
                className="h-5 w-5 shrink-0 rounded object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <span className="truncate font-medium">
              {row.original.bankName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'bankBic',
        header: 'SWIFT BIC',
        cell: ({ row }) => <CopyableId value={row.original.bankBic} />,
      },
      {
        accessorKey: 'website',
        header: 'Official Website',
        cell: ({ row }) =>
          row.original.website ? (
            <span className="truncate">{row.original.website}</span>
          ) : (
            <Dash />
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <BankStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created on',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original;
          // 原型 D6/D7：Details 文本按钮 + ⋮ 菜单。菜单按状态：
          // Inactive→Activate；Draft→Edit；Active→Deactivate；
          // Pending Onboarding→Edit+Deactivate；其余只读状态无菜单（不渲染 ⋮）。
          const menuItems: {
            label: string;
            danger?: boolean;
            onSelect: () => void;
          }[] = [];
          if (item.status === 50) {
            menuItems.push({
              label: 'Activate',
              onSelect: () => setStatusAction({ row: item, kind: 'activate' }),
            });
          }
          if (item.status === 1 || item.status === 10) {
            menuItems.push({
              label: 'Edit',
              onSelect: () =>
                router.push(`${LIST_PATH}/edit?id=${item.bankId}`),
            });
          }
          if (item.status === 10 || item.status === 20) {
            menuItems.push({
              label: 'Deactivate',
              danger: true,
              onSelect: () =>
                setStatusAction({ row: item, kind: 'deactivate' }),
            });
          }
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`${LIST_PATH}/detail?id=${item.bankId}`)
                }
              >
                Details
              </Button>
              {menuItems.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Actions for ${item.bankName}`}
                    >
                      <MoreVertical
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {menuItems.map((menuItem) => (
                      <DropdownMenuItem
                        key={menuItem.label}
                        className={
                          menuItem.danger
                            ? 'text-destructive focus:text-destructive'
                            : undefined
                        }
                        onClick={menuItem.onSelect}
                      >
                        {menuItem.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [router],
  );


  const tableData = React.useMemo(
    () => rows.map((r: BankRow) => ({ ...r, id: String(r.bankId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Bank List
            </div>
            {!isLoading && paginationMeta ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push(`${LIST_PATH}/create`)}
          >
            Onboard Bank
          </Button>
        </div>
        <form
          onSubmit={handleSubmit(onSearch)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="bankName"
              label="Bank Name"
              placeholder="Fuzzy match"
              register={register('bankName')}
            />
            <FormField
              name="bankBic"
              label="Bank Code"
              placeholder="Fuzzy match"
              register={register('bankBic')}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Status
              </label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value || STATUS_ALL}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>All</SelectItem>
                      {[1, 10, 5, 15, 20, 50].map((code) => (
                        <SelectItem key={code} value={String(code)}>
                          {protoStatusLabel(PROTO_BANK_STATUS, code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>
        </form>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No banks found."
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: (page) =>
                        setParams((prev) => ({ ...prev, pageNum: page })),
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setParams((prev) => ({
                          ...prev,
                          pageNum: 1,
                          pageSize: n,
                        }));
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      {accessKeyBank && (
        <AccessKeyDrawer
          bank={accessKeyBank}
          onClose={() => setAccessKeyBank(null)}
        />
      )}
      {interactBank && (
        <InteractDrawer
          bank={interactBank}
          onClose={() => setInteractBank(null)}
        />
      )}
      {/* Deactivate/Activate 确认弹窗（原型 BANK_ACTION_CONFIG 文案逐字）。 */}
      <ActionConfirmDialog
        open={statusAction !== null}
        onOpenChange={(open) => {
          if (
            !open &&
            !disableMutation.isPending &&
            !enableMutation.isPending
          ) {
            setStatusAction(null);
          }
        }}
        icon={statusAction?.kind === 'activate' ? CircleCheck : CirclePause}
        variant={statusAction?.kind === 'activate' ? 'confirm' : 'destructive'}
        title={
          statusAction?.kind === 'activate'
            ? 'Activate Bank'
            : 'Deactivate Bank'
        }
        body1={
          statusAction
            ? `${
                statusAction.kind === 'activate' ? 'Activate' : 'Deactivate'
              } bank "${statusAction.row.bankName}"?`
            : ''
        }
        body2={
          statusAction?.kind === 'activate'
            ? 'Once activated, the bank can take part in quotes and settlements, subject to its gateway instance being connected.'
            : 'Once deactivated, its gateway instances are deactivated, their quotes fail, and its tokens no longer take part in new quotes.'
        }
        confirmLabel={
          statusAction?.kind === 'activate' ? 'Activate' : 'Deactivate'
        }
        loading={disableMutation.isPending || enableMutation.isPending}
        onConfirm={onStatusConfirm}
      />
    </div>
  );
}

/* ================================================================== */
/* BankInfoFormPage — 登记/编辑（源 bank-dialog create/edit）            */
/* ================================================================== */

interface BankInfoFormValues {
  bankName: string;
  bankBic: string;
  website: string;
  logo: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  /** 表单不渲染；编辑态透传，避免清空实例登记维护的账户配置（源一致）。 */
  accountConfig: string;
}

const EMPTY_FORM: BankInfoFormValues = {
  bankName: '',
  bankBic: '',
  website: '',
  logo: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  accountConfig: '',
};

export function BankInfoFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const bankId = parseBankId(searchParams.get('id'));
  const isEdit = bankId != null;

  const { data: detail, isLoading: detailLoading } = useBankDetailQuery(
    KISSEN_PROJECT_ID,
    bankId,
  );
  const saveMutation = useSaveBankMutation(KISSEN_PROJECT_ID);

  const { register, handleSubmit, reset, setValue, watch, formState } =
    useForm<BankInfoFormValues>({
      defaultValues: EMPTY_FORM,
    });
  const logoValue = watch('logo');

  // 源 onLogoChange（4685063）：前端压 64×64 PNG data URI 直存（base 无文件服务）。
  const onLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.warning('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.warning('Image must be 2MB or smaller');
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setValue('logo', dataUrl, { shouldDirty: true });
    } catch {
      toast.warning('Could not read the image, please try another file');
    }
  };

  // 编辑态回填（源 loadDetail；accountConfig 为透传字段，实例登记维护）。
  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset({
      bankName: detail.bankName ?? '',
      bankBic: detail.bankBic ?? '',
      website: detail.website ?? '',
      logo: detail.logo ?? '',
      contactName: detail.contactName ?? '',
      contactPhone: detail.contactPhone ?? '',
      contactEmail: detail.contactEmail ?? '',
      address: detail.address ?? '',
      accountConfig: detail.accountConfig ?? '',
    });
  }, [detail, isEdit, reset]);

  const onSubmit = handleSubmit((v) => {
    const payload: BankSaveReq = {
      bankId: isEdit ? bankId : undefined,
      bankName: v.bankName.trim(),
      bankBic: v.bankBic.trim(),
      website: v.website.trim() || undefined,
      logo: v.logo.trim() || undefined,
      contactName: v.contactName.trim() || undefined,
      contactPhone: v.contactPhone.trim() || undefined,
      contactEmail: v.contactEmail.trim() || undefined,
      address: v.address.trim() || undefined,
      accountConfig: v.accountConfig || undefined,
    };
    saveMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Registered (pending onboarding)');
        router.push(LIST_PATH);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  });

  const submitting = saveMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-28">
      {/* 页面头：返回 + 标题 + 说明（全宽，不限制内容宽度）。 */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mt-0.5 size-9 shrink-0"
            onClick={() => router.push(LIST_PATH)}
            disabled={submitting}
            aria-label="Back to bank list"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {isEdit ? 'Edit Bank' : 'Register Bank'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEdit
                ? 'Update the bank identity and contact details.'
                : 'Register a bank as Registered (pending onboarding).'}
            </p>
          </div>
        </div>
      </header>

      {isEdit && detailLoading && (
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-float">
          <Skeleton className="h-4 w-40" />
        </div>
      )}

      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <AlertTitle>Registration needs no approval</AlertTitle>
        <AlertDescription>
          Saving registers the bank as Registered (pending onboarding); formal
          onboarding is initiated by the bank via the bank portal plus KBO
          approval. Currency-system information is registered with the gateway
          instance in Instance Management; tokens and limits are not configured
          here.
        </AlertDescription>
      </Alert>

      {/* 身份信息（全宽卡片 + 图标分区头）。 */}
      <section className="overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-float">
        <BankDetailSectionHeader
          icon={Landmark}
          title="Bank Identity"
          description="Name, code, website, and logo used across the network."
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="bankName"
            label="Bank Name"
            required
            error={
              formState.errors.bankName
                ? 'Please enter the bank name'
                : undefined
            }
            register={register('bankName', { required: true, maxLength: 64 })}
          />
          <FormField
            name="bankBic"
            label="Bank Code/BIC"
            required
            placeholder="Used for bootstrap auth (BIC + access key)"
            error={
              formState.errors.bankBic
                ? 'Please enter the bank code (BIC)'
                : undefined
            }
            register={register('bankBic', { required: true, maxLength: 64 })}
          />
          <FormField
            name="website"
            label="Official Website"
            placeholder="Optional, e.g. https://bank.example.com"
            register={register('website', { maxLength: 300 })}
          />
          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <span className="text-sm font-medium leading-none">Bank Logo</span>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40">
                {logoValue ? (
                  <img
                    src={logoValue}
                    alt="Bank logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
              <label htmlFor="bank-logo-upload">
                <Button variant="outline" size="sm" asChild>
                  <span>{logoValue ? 'Change' : 'Upload Image'}</span>
                </Button>
              </label>
              <input
                id="bank-logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoChange}
              />
              {logoValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  disabled={submitting}
                  onClick={() => setValue('logo', '', { shouldDirty: true })}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Optional; auto-compressed to 64×64
            </p>
          </div>
        </div>
      </section>

      {/* 联系信息（全宽卡片 + 图标分区头）。 */}
      <section className="overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-float">
        <BankDetailSectionHeader
          icon={User}
          title="Contact Details"
          description="Optional; editable via the bank portal after onboarding."
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="contactName"
            label="Contact Name"
            placeholder="Optional; editable via the bank portal after onboarding"
            register={register('contactName', { maxLength: 64 })}
          />
          <FormField
            name="contactEmail"
            label="Email"
            placeholder="Optional; receives credential and approval notifications"
            register={register('contactEmail', { maxLength: 128 })}
          />
          <FormField
            name="address"
            label="Address"
            placeholder="Optional"
            register={register('address', { maxLength: 200 })}
          />
        </div>
      </section>

      {/* 底部操作条：贴底固定，右侧主操作。 */}
      <div className="sticky bottom-0 z-10 -mx-px flex items-center justify-end gap-3 rounded-xl border border-border/60 bg-card/95 p-4 text-card-foreground shadow-float backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(LIST_PATH)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

/* BankInfoDetailPage — 详情（原型 BankDetailsPage：单层页头 + 四 Tab + 两信息抽屉） */
/* ================================================================== */

/** 详情 Tab 值（?tab= 写 URL；basic 缺省不占 query）。 */
type BankDetailTab = 'basic' | 'instances' | 'tokens' | 'operations';

export function BankInfoDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = parseBankId(searchParams.get('id'));

  // Tab 状态写 URL（原型同款：basic 缺省不占 query，刷新/分享/后退保持）。
  const tabParam = searchParams.get('tab');
  const activeTab: BankDetailTab =
    tabParam === 'instances' ||
    tabParam === 'tokens' ||
    tabParam === 'operations'
      ? tabParam
      : 'basic';
  const handleTabChange = (next: string) => {
    const params = new URLSearchParams();
    if (bankId != null) params.set('id', String(bankId));
    if (next !== 'basic') params.set('tab', next);
    router.replace(`${LIST_PATH}/detail?${params.toString()}`, {
      scroll: false,
    });
  };

  /** 信息/动作型抽屉（原型 D4/D5：Access Keys / Token Permissions）。 */
  const [accessKeyBank, setAccessKeyBank] = React.useState<BankRow | null>(
    null,
  );
  const [interactBank, setInteractBank] = React.useState<BankRow | null>(null);

  const detailQuery = useBankDetailQuery(KISSEN_PROJECT_ID, bankId);
  // 实例/代币常驻加载：页签计数需要 total，单银行数据量小。
  const instancesQuery = useInstanceListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 100,
    filter: { bankId: bankId ?? 0 },
  });
  const tokensQuery = useTokenListQuery(
    KISSEN_PROJECT_ID,
    { bankId: bankId ?? 0 },
    bankId != null,
  );

  if (!bankId) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <p className="text-sm text-muted-foreground">Missing bank ID</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(LIST_PATH)}
        >
          Back
        </Button>
      </div>
    );
  }

  const detail = detailQuery.data;
  const websiteUrl = safeExternalUrl(detail?.website);
  const instances = instancesQuery.data?.data ?? [];
  const instanceTotal =
    instancesQuery.data?.pagination?.total ?? instances.length;
  const tokens = tokensQuery.data ?? [];
  // DataTable 泛型约束 { id: string }：行数据补前端 id。
  const instanceRows = React.useMemo(
    () =>
      instances.map((r: InstanceRow) => ({ ...r, id: String(r.instanceId) })),
    [instances],
  );
  const tokenRows = React.useMemo(
    () => tokens.map((r: TokenRow) => ({ ...r, id: String(r.tokenId) })),
    [tokens],
  );

  /** instances Tab 列（原型 D14：口径同 Gateway 列表，Actions=Details 进实例详情）。 */
  const instanceColumns = React.useMemo<
    ColumnDef<InstanceRow & { id: string }>[]
  >(
    () => [
      {
        id: 'instanceId',
        header: 'Instance ID',
        cell: ({ row }) => (
          <CopyableId
            value={row.original.instanceCode || String(row.original.instanceId)}
          />
        ),
      },
      {
        accessorKey: 'endpointUrl',
        header: 'Endpoint URL',
        cell: ({ row }) =>
          row.original.endpointUrl ? (
            <span className="block max-w-[220px] truncate">
              {row.original.endpointUrl}
            </span>
          ) : (
            <Dash />
          ),
      },
      {
        accessorKey: 'upKeyFingerprint',
        header: 'Upstream Public Key Fingerprint',
        cell: ({ row }) =>
          row.original.upKeyFingerprint ? (
            <CopyableId value={row.original.upKeyFingerprint} />
          ) : (
            <Dash />
          ),
      },
      {
        accessorKey: 'downKeyFingerprint',
        header: 'Downstream Public Key Fingerprint',
        cell: ({ row }) =>
          row.original.downKeyFingerprint ? (
            <CopyableId value={row.original.downKeyFingerprint} />
          ) : (
            <Dash />
          ),
      },
      {
        accessorKey: 'connectivityStatus',
        header: 'Connectivity',
        cell: ({ row }) => (
          <ConnectivityBadge status={row.original.connectivityStatus} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <InstanceStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'lastHeartbeatTime',
        header: 'Last Heartbeat',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.lastHeartbeatTime)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() =>
              router.push(
                `/onboard/instance/detail?id=${row.original.instanceId}`,
              )
            }
          >
            Details
          </Button>
        ),
      },
    ],
    [router],
  );

  /** tokens Tab 列（原型 D14：口径同 Token 列表，省略 Bank 列——本页已限定银行）。 */
  const tokenColumns = React.useMemo<
    ColumnDef<TokenRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'tokenName',
        header: 'Token Name',
        cell: ({ row }) => row.original.tokenName || <Dash />,
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
        accessorKey: 'chainType',
        header: 'Blockchain',
        cell: ({ row }) => row.original.chainType || <Dash />,
      },
      {
        accessorKey: 'tokenCode',
        header: 'Token Code',
        cell: ({ row }) => <CopyableId value={row.original.tokenCode} />,
      },
      {
        accessorKey: 'minLiquidity',
        header: 'Min. Liquidity',
        cell: ({ row }) => {
          const raw = row.original.minLiquidity;
          if (raw === null || raw === undefined || raw === '') return <Dash />;
          return (
            <span className="block text-right tabular-nums">
              {formatTokenAmount(raw)}
              {row.original.symbol ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  {row.original.symbol}
                </span>
              ) : null}
            </span>
          );
        },
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
        header: 'Registered on',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
    ],
    [],
  );

  const tabCount = (tab: BankDetailTab) => {
    if (tab === 'instances') return instanceTotal;
    if (tab === 'tokens') return tokens.length;
    return 0; // operations：GAP-ADM-02 静态空表，恒 0。
  };

  return (
    <div className="space-y-4">
      {/* 单层页头（原型 §3.15）：Back + 标题 + 状态徽章 + 元信息行 + 两信息抽屉入口。 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to bank list"
          onClick={() => router.push(LIST_PATH)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">
              {detail?.bankName || 'Bank Details'}
            </h1>
            {detail ? <BankStatusBadge status={detail.status} /> : null}
          </div>
          {detail ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                Bank Code:{' '}
                <span className="font-semibold text-foreground">
                  {detail.bankBic || <Dash />}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Created on {formatUtc8(detail.createTime)}
              </span>
            </p>
          ) : null}
        </div>
        {detail ? (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccessKeyBank(detail)}
            >
              <KeyRound className="size-4" aria-hidden="true" />
              Access Keys
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInteractBank(detail)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Token Permissions
            </Button>
          </div>
        ) : null}
      </div>

      {detailQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Failed to load bank details.</AlertTitle>
        </Alert>
      ) : null}
      {!detailQuery.isLoading && !detailQuery.isError && !detail ? (
        <p className="text-sm text-muted-foreground">Bank not found.</p>
      ) : null}

      {detail ? (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          {/* 页签条独立于 Card（原型门禁），带计数（basic 非集合无计数）。 */}
          <TabsList>
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            {(
              [
                ['instances', 'Gateway Instances'],
                ['tokens', 'Tokens'],
                ['operations', 'Operation History'],
              ] as const
            ).map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                  {tabCount(value)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 1：basic —— 原型字段序 + 本仓超集（Logo/Phone/Address）。 */}
          <TabsContent value="basic" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              <BankDetailSectionHeader
                icon={Landmark}
                title="Basic Information"
              />
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField icon={Landmark} label="Bank Name">
                  {detail.bankName || <Dash />}
                </DetailField>
                <DetailField icon={Hash} label="SWIFT BIC">
                  <CopyableEllipsisText
                    value={detail.bankBic}
                    emptyText="-"
                    maxWidth={200}
                    className="font-mono"
                  />
                </DetailField>
                <DetailField icon={Globe} label="Official Website">
                  {websiteUrl ? (
                    <a
                      className="inline-flex items-center gap-1 break-all font-medium text-primary underline-offset-4 hover:underline"
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(detail.website ?? '').replace(/^https?:\/\//, '')}
                      <ExternalLink
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  ) : (
                    <Dash />
                  )}
                </DetailField>
                {/* STATIC-FILLER(GAP-ADM-08): 后端 BankRow 无 jurisdiction 字段，空值渲染 Dash 不编造。 */}
                <DetailField icon={MapPin} label="Jurisdiction">
                  <Dash />
                </DetailField>
                <DetailField icon={User} label="Contact Name">
                  {detail.contactName || <Dash />}
                </DetailField>
                <DetailField icon={Mail} label="Contact Email">
                  {detail.contactEmail ? (
                    <a
                      href={`mailto:${detail.contactEmail}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {detail.contactEmail}
                    </a>
                  ) : (
                    <Dash />
                  )}
                </DetailField>
                {/* STATIC-FILLER(GAP-ADM-08): 货币系统字段随实例登记（BankRow 无此字段），渲染 Dash。 */}
                <DetailField icon={Landmark} label="Currency System Type">
                  <Dash />
                </DetailField>
                {/* STATIC-FILLER(GAP-ADM-08): 同上，Blockchain Network 随实例域，渲染 Dash。 */}
                <DetailField icon={Network} label="Blockchain Network">
                  <Dash />
                </DetailField>
                {/* STATIC-FILLER(GAP-ADM-08): 同上，Currency System Name 随实例域，渲染 Dash。 */}
                <DetailField icon={Coins} label="Currency System Name">
                  <Dash />
                </DetailField>
                {/* STATIC-FILLER(GAP-ADM-08): 同上，Currency System URL 随实例域，渲染 Dash。 */}
                <DetailField icon={Globe} label="Currency System URL">
                  <Dash />
                </DetailField>
                {/* STATIC-FILLER(GAP-ADM-08): 后端无 integrationNotes 字段，渲染 Dash。 */}
                <DetailField icon={Info} label="Integration Notes">
                  <Dash />
                </DetailField>
                {/* 本仓超集字段（原型无）：Logo / Contact Phone / Address。 */}
                <DetailField icon={Landmark} label="Bank Logo">
                  {detail.logo ? (
                    <img
                      src={detail.logo}
                      alt={`${detail.bankName} logo`}
                      className="h-8 w-auto object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Dash />
                  )}
                </DetailField>
                <DetailField icon={Phone} label="Contact Phone">
                  <span className="font-mono">
                    {detail.contactPhone || <Dash />}
                  </span>
                </DetailField>
                <DetailField icon={MapPin} label="Address">
                  <span className="whitespace-pre-wrap break-all">
                    {detail.address || <Dash />}
                  </span>
                </DetailField>
                <DetailField icon={Landmark} label="Status">
                  <BankStatusBadge status={detail.status} />
                </DetailField>
                <DetailField icon={Calendar} label="Created on">
                  <span className="tabular-nums">
                    {formatUtc8(detail.createTime)}
                  </span>
                </DetailField>
              </div>
            </section>
          </TabsContent>

          {/* Tab 2：instances —— 口径同 Gateway 列表（原型 D14）。 */}
          <TabsContent value="instances" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              {instancesQuery.isError ? (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertTitle>
                      Failed to load gateway instances.
                    </AlertTitle>
                  </Alert>
                </div>
              ) : (
                <DataTable
                  columns={instanceColumns}
                  data={instanceRows}
                  isLoading={instancesQuery.isLoading}
                  emptyMessage="No gateway instances registered for this bank."
                />
              )}
            </section>
          </TabsContent>

          {/* Tab 3：tokens —— 口径同 Token 列表，省略 Bank 列（原型 D14）。 */}
          <TabsContent value="tokens" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              {tokensQuery.isError ? (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertTitle>Failed to load tokens.</AlertTitle>
                  </Alert>
                </div>
              ) : (
                <DataTable
                  columns={tokenColumns}
                  data={tokenRows}
                  isLoading={tokensQuery.isLoading}
                  emptyMessage="No tokens registered for this bank."
                />
              )}
            </section>
          </TabsContent>

          {/* Tab 4：operations —— 静态空表（GAP-ADM-02）。 */}
          <TabsContent value="operations" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              {/* STATIC-FILLER(GAP-ADM-02): operate-log 无按对象（bankId）过滤 API，
                  静态空表 + 列契约（Timestamp/Operator/Module/Status/Trace ID）。 */}
              <DataTable
                columns={BANK_OPERATION_COLUMNS}
                data={[] as { id: string }[]}
                emptyMessage="No operations recorded for this bank."
              />
            </section>
          </TabsContent>
        </Tabs>
      ) : detailQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : null}

      {accessKeyBank && (
        <AccessKeyDrawer
          bank={accessKeyBank}
          onClose={() => setAccessKeyBank(null)}
        />
      )}
      {interactBank && (
        <InteractDrawer
          bank={interactBank}
          onClose={() => setInteractBank(null)}
        />
      )}
    </div>
  );
}
