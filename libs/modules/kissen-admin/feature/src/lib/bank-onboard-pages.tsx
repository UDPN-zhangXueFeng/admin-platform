'use client';

/**
 * Bank onboarding pages — tokenized v2.0 rewrite (source
 * `views/onboard/bank/`: index.vue + bank-dialog.vue + access-key-drawer.vue
 * + interact-drawer.vue).
 *
 * Exports (module-page-registry contract for module `bank`):
 *   BankInfoListPage   → list (+ inline Access-Key / Interact drawers)
 *   BankInfoFormPage   → create/edit route page (source bank-dialog)
 *   BankInfoDetailPage → view route page (source bank-dialog view mode)
 */

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { Copy, Info, KeyRound, TriangleAlert } from 'lucide-react';
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
  type TableRowAction,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { formatAdminDateTime } from '@myorg/shared/util-dates';

import {
  BANK_STATUS_LABEL,
  BANK_STATUS_OPTIONS,
  CONNECTIVITY_STATUS_LABEL,
  CONNECTIVITY_STATUS_VARIANT,
  CS_TYPE_LABEL,
  INSTANCE_STATUS_LABEL,
  INSTANCE_STATUS_VARIANT,
  KEY_STATUS_LABEL,
  KISSEN_PROJECT_ID,
  REVOKE_REASON_LABEL,
  bankStatusVariant,
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
  type InteractPeerRow,
  type InteractTokenRow,
  type InstanceRow,
  type TokenRow,
  TOKEN_STATUS_LABEL,
  TOKEN_STATUS_VARIANT,
} from '@myorg/modules/kissen-admin/data-access';

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

function BankStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={bankStatusVariant(status)}>
      {BANK_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function DetailField({
  label,
  span = false,
  children,
}: {
  label: string;
  /** 长文本：自 sm 断点起跨满两列（§6.3）。 */
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span ? 'sm:col-span-2 lg:col-span-3' : undefined}>
      <div className="space-y-1.5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
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
    navigator.clipboard
      .writeText(generated.accessKey)
      .then(() => toast.success('Copied'))
      .catch(() => toast.error('Copy failed. Please copy manually.'));
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
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

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

  /** 禁用（10/20 → 50；实例停用、报价失败、代币不再参与新报价）。 */
  const onDisable = React.useCallback(
    (row: BankRow) => {
      setConfirm({
        title: 'Disable Bank',
        description: `Disable bank "${row.bankName}"? Its gateway instances are deactivated, their quotes fail, and its tokens no longer take part in new quotes.`,
        actionLabel: 'Disable',
        destructive: true,
        onConfirm: () => {
          disableMutation.mutate(row.bankId, {
            onSuccess: () => toast.success('Disabled'),
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [disableMutation, toast],
  );

  /** 启用（50 → 20；恢复禁用前的入网状态）。 */
  const onEnable = React.useCallback(
    (row: BankRow) => {
      setConfirm({
        title: 'Enable Bank',
        description: `Enable bank "${row.bankName}"? The bank returns to the Onboarded state it held before being disabled.`,
        actionLabel: 'Enable',
        onConfirm: () => {
          enableMutation.mutate(row.bankId, {
            onSuccess: () => toast.success('Enabled'),
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [enableMutation, toast],
  );

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
            <span className="truncate">{row.original.bankName}</span>
          </div>
        ),
      },
      { accessorKey: 'bankBic', header: 'Bank Code/BIC' },
      {
        accessorKey: 'website',
        header: 'Official Website',
        cell: ({ row }) => (
          <span className="truncate">{row.original.website || '-'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <BankStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created On',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.createTime)}
          </span>
        ),
      },
      createActionColumn<BankRow & { id: string }>((item) => {
        const s = item.status;
        const actions: TableRowAction<BankRow & { id: string }>[] = [
          {
            label: 'Details',
            onClick: () => router.push(`${LIST_PATH}/detail?id=${item.bankId}`),
          },
        ];
        if (s !== 20) {
          actions.push({
            label: 'Edit',
            onClick: () => router.push(`${LIST_PATH}/edit?id=${item.bankId}`),
          });
        }
        if (s === 10 || s === 20) {
          actions.push({
            label: 'Disable',
            destructive: true,
            onClick: () => onDisable(item),
          });
        }
        if (s === 50) {
          actions.push({ label: 'Enable', onClick: () => onEnable(item) });
        }
        actions.push(
          { label: 'Access Keys', onClick: () => setAccessKeyBank(item) },
          { label: 'Token Permissions', onClick: () => setInteractBank(item) },
        );
        return actions;
      }),
    ],
    [onDisable, onEnable, router],
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
              Banks
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
            Register Bank
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
              label="Bank Code (BIC)"
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
                      {BANK_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
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
              emptyMessage="No banks yet"
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
      <ConfirmAlertDialog
        request={confirm}
        onDismiss={() => setConfirm(null)}
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
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && detailLoading && (
        <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <Skeleton className="h-4 w-40" />
        </div>
      )}

      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit Bank' : 'Register Bank'}
        </div>
        <Alert className="mb-6">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <AlertTitle>Registration needs no approval</AlertTitle>
          <AlertDescription>
            Saving registers the bank as Registered (pending onboarding); formal
            onboarding is initiated by the bank via the bank portal plus KBO
            approval. Currency-system information is registered with the gateway
            instance in Instance Management; tokens and limits are not
            configured here.
          </AlertDescription>
        </Alert>

        {/* §6.4 Section：标题 + 说明 + 分隔组织字段。 */}
        <div className="mb-4">
          <div className="text-sm font-medium">Basic Information</div>
          <p className="text-sm text-muted-foreground">
            Bank identity, website, and contact details.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <div className="space-y-2">
            <span className="text-sm font-medium leading-none">Bank Logo</span>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
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

      <div className="flex items-center justify-between rounded-lg border-border/60 bg-card p-4 text-card-foreground shadow-float">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(LIST_PATH)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Save
        </Button>
      </div>
    </form>
  );
}

/* BankInfoDetailPage — 查看态（源 bank-dialog view） */
/* ================================================================== */

export function BankInfoDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = parseBankId(searchParams.get('id'));
  const [activeTab, setActiveTab] = React.useState('basic');
  const [expandedInstanceId, setExpandedInstanceId] = React.useState<
    number | null
  >(null);
  const [instancePage, setInstancePage] = React.useState(1);

  const detailQuery = useBankDetailQuery(KISSEN_PROJECT_ID, bankId);
  const instancesQuery = useInstanceListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: instancePage, pageSize: 100, filter: { bankId: bankId ?? 0 } },
    bankId != null && activeTab === 'gateways',
  );
  const tokensQuery = useTokenListQuery(
    KISSEN_PROJECT_ID,
    { bankId: bankId ?? 0 },
    bankId != null &&
      (activeTab === 'tokens' ||
        (activeTab === 'gateways' && expandedInstanceId != null)),
  );
  React.useEffect(() => {
    if (activeTab !== 'gateways') setExpandedInstanceId(null);
  }, [activeTab]);
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
  const tokens = tokensQuery.data ?? [];
  const renderQueryState = (
    query: { isLoading: boolean; isError: boolean },
    empty: boolean,
    label: string,
  ) => {
    if (query.isLoading) return <Skeleton className="h-20 w-full" />;
    if (query.isError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Failed to load {label}.</AlertTitle>
        </Alert>
      );
    }
    if (empty)
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No {label} yet
        </p>
      );
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Hero Summary：银行名 + 状态；详细字段统一放在 Basic Information。 */}
      <section className="rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {detailQuery.isLoading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <span className="text-base font-semibold leading-6 text-foreground">
                  {detail?.bankName || '--'}
                </span>
              )}
              {detailQuery.isLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : detail ? (
                <BankStatusBadge status={detail.status} />
              ) : null}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => router.push(LIST_PATH)}
          >
            Back
          </Button>
        </div>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="gateways">Gateways</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>
        <TabsContent value="basic" className="mt-0">
          <section className="rounded-lg border border-border/60 bg-card p-4 sm:p-6">
            {detailQuery.isLoading ? (
              <Skeleton className="mb-4 h-5 w-40" />
            ) : null}
            {detailQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Failed to load bank details.</AlertTitle>
              </Alert>
            ) : null}
            {!detailQuery.isLoading && !detailQuery.isError && !detail ? (
              <p className="text-sm text-muted-foreground">Bank not found.</p>
            ) : null}
            {detail ? (
              <>
                <div className="mb-3 text-sm font-semibold">
                  Basic Information
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailField label="Bank Name">
                    {detail.bankName || '--'}
                  </DetailField>
                  <DetailField label="Bank Code/BIC">
                    <CopyableEllipsisText
                      value={detail.bankBic}
                      emptyText="--"
                      maxWidth={200}
                      className="font-mono"
                    />
                  </DetailField>
                  <DetailField label="Official Website">
                    {websiteUrl ? (
                      <a
                        className="break-all text-primary underline"
                        href={websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {detail.website}
                      </a>
                    ) : (
                      '--'
                    )}
                  </DetailField>
                  <DetailField label="Bank Logo">
                    {detail.logo ? (
                      <img
                        src={detail.logo}
                        alt={`${detail.bankName} logo`}
                        className="h-10 w-10 rounded object-contain"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      '--'
                    )}
                  </DetailField>
                  <DetailField label="Contact Name">
                    {detail.contactName || '--'}
                  </DetailField>
                  <DetailField label="Contact Phone">
                    {detail.contactPhone || '--'}
                  </DetailField>
                  <DetailField label="Contact Email">
                    {detail.contactEmail || '--'}
                  </DetailField>
                  <DetailField label="Address" span>
                    <span className="whitespace-pre-wrap break-all">
                      {detail.address || '--'}
                    </span>
                  </DetailField>
                  <DetailField label="Status">
                    <BankStatusBadge status={detail.status} />
                  </DetailField>
                  <DetailField label="Created On">
                    <span className="tabular-nums">
                      {formatTime(detail.createTime)}
                    </span>
                  </DetailField>
                </div>
              </>
            ) : null}
          </section>
        </TabsContent>
        <TabsContent value="gateways" className="mt-0">
          <section className="overflow-x-auto rounded-lg border border-border/60 bg-card p-4 sm:p-6">
            {renderQueryState(
              instancesQuery,
              instances.length === 0,
              'gateways',
            ) ?? (
              <>
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="p-2">Instance</th>
                      <th className="p-2">Endpoint</th>
                      <th className="p-2">Currency System</th>
                      <th className="p-2">Connectivity</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Last Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((row: InstanceRow) => (
                      <React.Fragment key={row.instanceId}>
                        <tr className="border-b">
                          <td className="p-2">
                            <button
                              type="button"
                              className="text-left text-primary underline"
                              onClick={() =>
                                setExpandedInstanceId((current) =>
                                  current === row.instanceId
                                    ? null
                                    : row.instanceId,
                                )
                              }
                            >
                              {row.instanceCode || '--'} /{' '}
                              {row.instanceName || '--'}
                            </button>
                          </td>
                          <td className="max-w-[240px] break-all p-2 font-mono">
                            {row.endpointUrl || '--'}
                          </td>
                          <td className="p-2">
                            {[
                              row.currencySystemName,
                              CS_TYPE_LABEL[row.currencySystemType] ??
                                'Not specified',
                              row.blockchain,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '--'}
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={
                                CONNECTIVITY_STATUS_VARIANT[
                                  row.connectivityStatus
                                ] ?? 'secondary'
                              }
                            >
                              {CONNECTIVITY_STATUS_LABEL[
                                row.connectivityStatus
                              ] ?? 'Unknown'}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={
                                INSTANCE_STATUS_VARIANT[row.status] ?? 'outline'
                              }
                            >
                              {INSTANCE_STATUS_LABEL[row.status] ?? row.status}
                            </Badge>
                          </td>
                          <td className="p-2 tabular-nums">
                            {formatTime(row.lastHeartbeatTime)}
                          </td>
                        </tr>
                        {expandedInstanceId === row.instanceId ? (
                          <tr className="border-b bg-muted/20">
                            <td colSpan={6} className="p-3">
                              <TokenRows
                                // Tokens are bank-scoped in the real API, not
                                // attached to a gateway instance.
                                tokens={tokens}
                                query={tokensQuery}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {(instancesQuery.data?.pagination.totalPages ?? 1) > 1 ? (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <span className="text-sm text-muted-foreground">
                      Page {instancePage} of{' '}
                      {instancesQuery.data?.pagination.totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={instancePage <= 1}
                      onClick={() => {
                        setInstancePage((page) => page - 1);
                        setExpandedInstanceId(null);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        instancePage >=
                        (instancesQuery.data?.pagination.totalPages ?? 1)
                      }
                      onClick={() => {
                        setInstancePage((page) => page + 1);
                        setExpandedInstanceId(null);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </TabsContent>
        <TabsContent value="tokens" className="mt-0">
          <section className="overflow-x-auto rounded-lg border border-border/60 bg-card p-4 sm:p-6">
            {renderQueryState(tokensQuery, tokens.length === 0, 'tokens') ?? (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2">Code</th>
                    <th className="p-2">Symbol</th>
                    <th className="p-2">Chain</th>
                    <th className="p-2">Pegged Currency</th>
                    <th className="p-2">Min Liquidity</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <TokenRowView key={token.tokenId} token={token} />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TokenRowView({ token }: { token: TokenRow }) {
  return (
    <tr className="border-b">
      <td className="p-2 font-mono">{token.tokenCode || '--'}</td>
      <td className="p-2">{token.symbol || '--'}</td>
      <td className="p-2">{token.chainType || '--'}</td>
      <td className="p-2">{token.anchorFiat || '--'}</td>
      <td className="p-2 tabular-nums">{token.minLiquidity ?? '--'}</td>
      <td className="p-2">
        <Badge variant={TOKEN_STATUS_VARIANT[token.status] ?? 'outline'}>
          {TOKEN_STATUS_LABEL[token.status] ?? token.status}
        </Badge>
      </td>
    </tr>
  );
}

function TokenRows({
  tokens,
  query,
}: {
  tokens: TokenRow[];
  query: { isLoading: boolean; isError: boolean };
}) {
  if (query.isLoading) return <Skeleton className="h-12 w-full" />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load gateway tokens.</AlertTitle>
      </Alert>
    );
  if (tokens.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No tokens for this gateway.
      </p>
    );
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="p-2">Code</th>
          <th className="p-2">Symbol</th>
          <th className="p-2">Chain</th>
          <th className="p-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((token) => (
          <tr key={token.tokenId}>
            <td className="p-2 font-mono">{token.tokenCode || '--'}</td>
            <td className="p-2">{token.symbol || '--'}</td>
            <td className="p-2">{token.chainType || '--'}</td>
            <td className="p-2">
              {TOKEN_STATUS_LABEL[token.status] ?? token.status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
