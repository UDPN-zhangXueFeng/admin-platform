'use client';

/**
 * 实例密钥抽屉（源 `views/instance-key/drawer.vue`，520px 右侧抽屉）。
 *
 * 挂壳层 header 常驻入口（Key icon，v-perm 'bank:key:manage' + locked 隐藏，
 * 见 kissen-app-shell.tsx），打开时拉取 GET /instance/key/view：
 * - 上行密钥对卡（本实例自生成）：指纹/生成时间/私钥指纹/私钥状态 +
 *   公钥 PEM pre 展示 + 公钥/私钥下载（私钥需登录口令二次确认，
 *   FR-BM-05-7：明文仅此一次展示，操作留痕）。
 * - 下行公钥卡（管理侧下发）：指纹/下发时间 + PEM pre。
 * - 接入与重置卡：accessKeyStatus 三态徽标（激活即失效，仅展示）+
 *   重置 dropdown（upstream/downstream 分方向 warning 二次确认）。
 *
 * 交互约定（源 ElMessageBox → 目标等价物）：
 * - 私钥口令 prompt → 受控 Dialog + PasswordField（必填校验）。
 * - 重置 warning confirm → AlertDialog（destructive 动作样式）。
 * - 成功提示 toast.success；失败沿用 client 拦截器 toast，页面仅
 *   静默（源 catch 注释「拦截器已提示」）。
 */
import * as React from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Fingerprint,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  PasswordField,
  useToast,
} from '@myorg/shared/ui';

import {
  accessKeyStatusText,
  accessKeyStatusVariant,
  useInstanceKeyViewQuery,
  usePrivateKeyDownloadMutation,
  usePublicKeyDownloadMutation,
  useResetInstanceKeyMutation,
  type InstanceKeyView,
  type KeyResetReq,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatTime, orDash } from './kit';
import { EmptyHint, LoadingBlock } from './state-blocks';
import { DescField, DescGrid } from './desc-grid';

/** 详情抽屉宽度：桌面展示长指纹/PEM，移动端保持全宽。 */
const DRAWER_WIDTH_CLASS =
  'w-full max-w-none sm:w-[760px] lg:w-[860px] xl:w-[960px]';

/** PEM 文本落 .pem 文件下载（源 downloadPem，MIME 沿用 application/x-pem-file）。 */
function downloadPem(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/x-pem-file' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** PEM 展示块（源 .pem：mono、break-all、pre-wrap、限高滚动）；label 行带 Copy。 */
function PemBlock({ label, pem }: { label: string; pem?: string }) {
  const toast = useToast();

  // 与 CopyableEllipsisText 同路径：Clipboard API + toast 轻反馈（§6.3）。
  const onCopy = () => {
    if (!pem) return;
    navigator.clipboard.writeText(pem).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Copy failed'),
    );
  };

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        {pem ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onCopy}
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy
          </Button>
        ) : null}
      </div>
      <pre className="m-0 max-h-[168px] overflow-auto whitespace-pre-wrap break-all rounded-md bg-background px-3 py-2.5 font-mono text-xs leading-6 text-foreground shadow-inner">
        {pem || '-'}
      </pre>
    </div>
  );
}

/** Summary metric used to make key state scannable before the long PEM blocks. */
function SummaryMetric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3 shadow-float">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-foreground">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function KeyCardHeader({
  direction,
  title,
  description,
}: {
  direction: 'upstream' | 'downstream';
  title: string;
  description: string;
}) {
  const Icon = direction === 'upstream' ? ArrowUpToLine : ArrowDownToLine;

  return (
    <div className="flex items-start gap-3 border-b border-border/50 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          {direction === 'upstream' ? 'Uplink' : 'Downlink'}
        </p>
        <h3 className="mt-0.5 text-base font-semibold leading-6 text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Security posture and trust-chain summary shown before sensitive key material. */
function SecurityPosture({ view }: { view: InstanceKeyView }) {
  const hasUplink = Boolean(view.uplinkPublicKey && view.uplinkFingerprint);
  const hasDownlink = Boolean(
    view.downlinkPublicKey && view.downlinkFingerprint,
  );
  const isProtected =
    view.activated &&
    view.accessKeyStatus === 'VALID' &&
    hasUplink &&
    hasDownlink;
  const StatusIcon = isProtected ? ShieldCheck : ShieldAlert;

  return (
    <section
      className={
        isProtected
          ? 'rounded-xl border border-success/25 bg-success/5 p-4'
          : 'rounded-xl border border-warning/30 bg-warning/5 p-4'
      }
      aria-label="Security posture"
    >
      <div className="flex items-start gap-3">
        <StatusIcon
          className={
            isProtected
              ? 'mt-0.5 h-5 w-5 shrink-0 text-success'
              : 'mt-0.5 h-5 w-5 shrink-0 text-warning'
          }
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-foreground">
              Security posture
            </p>
            <Badge variant={isProtected ? 'default' : 'secondary'}>
              {isProtected ? 'Protected' : 'Action required'}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isProtected
              ? 'This instance has an active access key and a complete bidirectional key trust chain.'
              : 'Verify activation and complete both key directions before processing live operations.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <TrustNode
          label="Instance"
          value={view.activated ? 'Active' : 'Inactive'}
          ready={view.activated}
        />
        <TrustNode
          label="Uplink → management"
          value={hasUplink ? 'Verified' : 'Missing'}
          ready={hasUplink}
        />
        <TrustNode
          label="Management → downlink"
          value={hasDownlink ? 'Verified' : 'Missing'}
          ready={hasDownlink}
        />
      </div>
    </section>
  );
}

function TrustNode({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        <span
          className={
            ready
              ? 'h-1.5 w-1.5 rounded-full bg-success'
              : 'h-1.5 w-1.5 rounded-full bg-warning'
          }
          aria-hidden="true"
        />
        {label}
      </div>
      <div className="mt-1 text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

/* ================================================================== */
/* 私钥下载口令确认（源 ElMessageBox.prompt inputType="password"）      */
/* ================================================================== */

/**
 * 口令二次确认弹窗（受控）：必填非空（源 inputValidator）。
 * 仅在确认后触发下载 mutation；取消/关闭不动。
 */
function PrivateKeyPromptDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  // 打开时清空上次输入（源 prompt 每次弹出为空白输入）。
  React.useEffect(() => {
    if (open) {
      setPassword('');
      setTouched(false);
    }
  }, [open]);

  const invalid = touched && password === '';

  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Private Key Download Confirmation</DialogTitle>
          <DialogDescription>
            Enter your login password to confirm identity and download the
            private key. The plaintext is shown only this once.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label
            htmlFor="gw-key-password"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Login Password
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <PasswordField
            id="gw-key-password"
            autoComplete="current-password"
            aria-invalid={invalid}
            aria-describedby={invalid ? 'gw-key-password-error' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password !== '') onConfirm(password);
            }}
          />
          {/* 源 inputValidator：空值提示「请输入登录口令」。 */}
          {invalid && (
            <p
              id="gw-key-password-error"
              className="mt-1 text-sm text-destructive"
              role="alert"
            >
              Login password is required
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || password === ''}
            onClick={() => {
              setTouched(true);
              if (password !== '') onConfirm(password);
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            {pending ? 'Downloading…' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 重置方向确认（源 ElMessageBox.confirm type="warning"）               */
/* ================================================================== */

/** 分方向二次确认文案（源 onReset tip，warning 语义）。 */
const RESET_TIPS: Record<KeyResetReq['direction'], string> = {
  upstream:
    'The local uplink key pair will be regenerated and the new public key re-pushed to the management side. The old uplink key becomes invalid immediately.',
  downstream:
    'The management side will be requested to regenerate and deliver a new downlink public key. The old downlink public key becomes invalid immediately.',
};

function ResetConfirmDialog({
  direction,
  pending,
  onConfirm,
  onCancel,
}: {
  direction: KeyResetReq['direction'] | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog
      open={direction != null}
      onOpenChange={(o) => !o && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Key Reset Confirmation</AlertDialogTitle>
          <AlertDialogDescription>
            {direction != null ? RESET_TIPS[direction] : ''} Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* 破坏性动作用 destructive（源 el-button type="danger" plain 同族语义）。 */}
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={(e) => {
              // 阻止默认关闭：确认走 mutation 成功后再由 direction 置空收敛。
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            Reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ================================================================== */
/* 抽屉主体                                                             */
/* ================================================================== */

/**
 * 实例密钥抽屉（源 drawer.vue；打开即加载，四个端点：
 * view / public download / private download / reset）。
 */
export function InstanceKeyDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  // 源 @open="load"：仅打开时拉取（关闭挂起态随抽屉卸载）。
  const viewQuery = useInstanceKeyViewQuery(open);
  const view = viewQuery.data;

  const publicDownload = usePublicKeyDownloadMutation();
  const privateDownload = usePrivateKeyDownloadMutation();
  const resetMutation = useResetInstanceKeyMutation();

  /** 私钥口令弹窗开关（独立于抽屉）。 */
  const [pwdOpen, setPwdOpen] = React.useState(false);
  /** 重置目标方向（null=确认弹窗关闭）。 */
  const [resetDirection, setResetDirection] = React.useState<
    KeyResetReq['direction'] | null
  >(null);

  // 源 onDownloadPublic：GET public/download → uplink-public.pem。
  const onDownloadPublic = React.useCallback(() => {
    publicDownload.mutate(undefined, {
      onSuccess: (pem) => downloadPem(pem, 'uplink-public.pem'),
      onError: (e) => toast.error((e as Error).message),
    });
  }, [publicDownload, toast]);

  // 源 onDownloadPrivate：口令确认 → POST private/download → uplink-private.pem。
  const onConfirmPrivateDownload = React.useCallback(
    (password: string) => {
      privateDownload.mutate(
        { password },
        {
          onSuccess: (pem) => {
            downloadPem(pem, 'uplink-private.pem');
            // 源 success：私钥已下载,请妥善保管。
            toast.success('Private key downloaded. Keep it in a safe place');
            setPwdOpen(false);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [privateDownload, toast],
  );

  // 源 onReset：confirm → POST reset → success toast + 重载 view（mutation 内已失效缓存）。
  const onConfirmReset = React.useCallback(() => {
    if (resetDirection == null) return;
    resetMutation.mutate(
      { direction: resetDirection },
      {
        onSuccess: () => {
          // 源 success：密钥重置成功。
          toast.success('Key reset successfully');
          setResetDirection(null);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }, [resetDirection, resetMutation, toast]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={`${DRAWER_WIDTH_CLASS} overflow-y-hidden p-0`}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-7 lg:px-8">
          <DrawerHeader className="border-b-0 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <DrawerTitle>Instance Keys</DrawerTitle>
                    <DrawerDescription className="mt-1 truncate">
                      Uplink and downlink key status
                    </DrawerDescription>
                  </div>
                </div>
              </div>
              {view ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="shrink-0">
                      Reset keys
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setResetDirection('upstream')}
                    >
                      Reset uplink key
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setResetDirection('downstream')}
                    >
                      Reset downlink public key
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </DrawerHeader>

          <div className="mt-5 flex flex-col gap-5">
            {viewQuery.isLoading ? (
              <LoadingBlock />
            ) : !view ? (
              // 源 el-empty：暂无密钥信息（查询失败静默，拦截器已提示）。
              <EmptyHint text="No key information available" />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryMetric
                    icon={ShieldCheck}
                    label="Instance"
                    value={
                      <Badge variant={view.activated ? 'default' : 'secondary'}>
                        {view.activated ? 'Activated' : 'Not activated'}
                      </Badge>
                    }
                    hint={view.instanceId || '-'}
                  />
                  <SummaryMetric
                    icon={KeyRound}
                    label="Access key"
                    value={
                      <Badge
                        variant={accessKeyStatusVariant(view.accessKeyStatus)}
                      >
                        {accessKeyStatusText(view.accessKeyStatus)}
                      </Badge>
                    }
                    hint="One-time key status"
                  />
                  <SummaryMetric
                    icon={ArrowUpToLine}
                    label="Uplink"
                    value={view.uplinkPublicKey ? 'Available' : 'Missing'}
                    hint={
                      view.uplinkGeneratedTime
                        ? formatTime(view.uplinkGeneratedTime)
                        : 'No key generated'
                    }
                  />
                  <SummaryMetric
                    icon={ArrowDownToLine}
                    label="Downlink"
                    value={view.downlinkPublicKey ? 'Available' : 'Missing'}
                    hint={
                      view.downlinkPushTime
                        ? formatTime(view.downlinkPushTime)
                        : 'Not delivered'
                    }
                  />
                </div>

                <SecurityPosture view={view} />

                <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-float">
                  <KeyCardHeader
                    direction="upstream"
                    title="Uplink key pair"
                    description="Generated and managed by this instance"
                  />
                  <div className="flex flex-col gap-5 p-5">
                    <DescGrid cols={2} className="gap-x-6 gap-y-5">
                      <DescField label="Public key fingerprint" span>
                        <CopyableEllipsisText
                          value={view.uplinkFingerprint}
                          emptyText="-"
                          maxWidth={760}
                          className="t-identifier max-w-full"
                        />
                      </DescField>
                      <DescField
                        label="Private key fingerprint · verification only"
                        span
                      >
                        <CopyableEllipsisText
                          value={view.uplinkPrivateKeyFingerprint}
                          emptyText="-"
                          maxWidth={760}
                          className="t-identifier max-w-full"
                        />
                      </DescField>
                      <DescField label="Generated at">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <Clock3
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {formatTime(view.uplinkGeneratedTime)}
                        </span>
                      </DescField>
                      <DescField label="Private key status">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          {view.uplinkPrivateKeyStatus?.toUpperCase() ===
                          'PRESENT' ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-success"
                              aria-hidden="true"
                            />
                          ) : null}
                          {orDash(view.uplinkPrivateKeyStatus)}
                        </span>
                      </DescField>
                    </DescGrid>
                    <PemBlock
                      label="Public key PEM"
                      pem={view.uplinkPublicKey}
                    />
                    <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
                      <Button
                        size="sm"
                        disabled={publicDownload.isPending}
                        onClick={onDownloadPublic}
                      >
                        {publicDownload.isPending && (
                          <Loader2 className="animate-spin" />
                        )}
                        Download public key
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={privateDownload.isPending}
                        onClick={() => setPwdOpen(true)}
                      >
                        Download private key · re-auth required
                      </Button>
                      <span className="self-center text-[11px] text-muted-foreground">
                        Password required
                      </span>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-float">
                  <KeyCardHeader
                    direction="downstream"
                    title="Downlink public key"
                    description="Delivered by the management side"
                  />
                  <div className="flex flex-col gap-5 p-5">
                    <DescGrid cols={2} className="gap-x-6 gap-y-5">
                      <DescField label="Fingerprint" span>
                        <CopyableEllipsisText
                          value={view.downlinkFingerprint}
                          emptyText="-"
                          maxWidth={760}
                          className="t-identifier max-w-full"
                        />
                      </DescField>
                      <DescField label="Delivered at">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <Clock3
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {formatTime(view.downlinkPushTime)}
                        </span>
                      </DescField>
                    </DescGrid>
                    <PemBlock
                      label="Public key PEM"
                      pem={view.downlinkPublicKey}
                    />
                  </div>
                </section>

                <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground">
                  <Fingerprint
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    Fingerprints are safe to share for verification. Private key
                    material is never shown here and requires your login
                    password for download.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </DrawerContent>

      <PrivateKeyPromptDialog
        open={pwdOpen}
        pending={privateDownload.isPending}
        onOpenChange={setPwdOpen}
        onConfirm={onConfirmPrivateDownload}
      />
      <ResetConfirmDialog
        direction={resetDirection}
        pending={resetMutation.isPending}
        onConfirm={onConfirmReset}
        onCancel={() => setResetDirection(null)}
      />
    </Drawer>
  );
}
