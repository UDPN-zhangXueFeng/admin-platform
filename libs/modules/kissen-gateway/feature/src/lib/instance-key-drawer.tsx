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
import { ChevronDown, Copy, KeyRound, Loader2 } from 'lucide-react';

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
  type KeyResetReq,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatTime, orDash } from './kit';
import { EmptyHint, LoadingBlock } from './state-blocks';
import { DescField, DescGrid } from './desc-grid';

/** 源抽屉尺寸 520px（el-drawer size="520px"）。 */
const DRAWER_WIDTH_CLASS = 'sm:max-w-[520px]';

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
    <div className="mt-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {pem ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={onCopy}
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy
          </Button>
        ) : null}
      </div>
      <pre className="m-0 max-h-[120px] overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 px-2 py-2 font-mono text-[11px] leading-relaxed">
        {pem || '-'}
      </pre>
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
            <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
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
    <AlertDialog open={direction != null} onOpenChange={(o) => !o && onCancel()}>
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
  const [resetDirection, setResetDirection] =
    React.useState<KeyResetReq['direction'] | null>(null);

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
            toast.success(
              'Private key downloaded. Keep it in a safe place',
            );
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
      <DrawerContent className={DRAWER_WIDTH_CLASS}>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Instance Keys
          </DrawerTitle>
          <DrawerDescription>
            Uplink key pair and downlink public key status
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-3.5">
          {viewQuery.isLoading ? (
            <LoadingBlock />
          ) : !view ? (
            // 源 el-empty：暂无密钥信息（查询失败静默，拦截器已提示）。
            <EmptyHint text="No key information available" />
          ) : (
            <>
              {/* 激活徽标 + 实例号（源 key-meta）→ §6.3 Hero：状态 + 可复制标识。 */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Badge variant={view.activated ? 'default' : 'secondary'}>
                  {view.activated ? 'Activated' : 'Not Activated'}
                </Badge>
                <span className="text-sm text-muted-foreground">Instance</span>
                <CopyableEllipsisText
                  value={view.instanceId}
                  emptyText="-"
                  maxWidth={260}
                  className="t-identifier"
                />
              </div>

              {/* 上行密钥对（本实例自生成）；指纹为核心信息（长文本占行 +
                  可复制），时间/状态为审计支撑（§6.3 分层）。 */}
              <section className="rounded-lg border border-border/60 bg-card">
                <div className="border-b border-border/50 px-4 py-3">
                  <h3 className="text-base font-semibold leading-6 text-foreground">
                    Uplink Key Pair (generated by this instance)
                  </h3>
                </div>
                <div className="panel-pad flex flex-col gap-3">
                  <DescGrid cols={2}>
                    <DescField label="Public Key Fingerprint" span>
                      <CopyableEllipsisText
                        value={view.uplinkFingerprint}
                        emptyText="-"
                        maxWidth={440}
                        className="t-identifier"
                      />
                    </DescField>
                    <DescField label="Private Key Fingerprint" span>
                      <CopyableEllipsisText
                        value={view.uplinkPrivateKeyFingerprint}
                        emptyText="-"
                        maxWidth={440}
                        className="t-identifier"
                      />
                    </DescField>
                    <DescField label="Generated At">
                      <span className="font-mono text-xs">
                        {formatTime(view.uplinkGeneratedTime)}
                      </span>
                    </DescField>
                    <DescField label="Private Key Status">
                      <span className="text-xs">
                        {orDash(view.uplinkPrivateKeyStatus)}
                      </span>
                    </DescField>
                  </DescGrid>
                  <PemBlock label="Public Key PEM" pem={view.uplinkPublicKey} />
                  {/* 下载动作贴近 PEM 字段（§6.3：动作贴近所服务的数据）。 */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={publicDownload.isPending}
                      onClick={onDownloadPublic}
                    >
                      {publicDownload.isPending && (
                        <Loader2 className="animate-spin" />
                      )}
                      Download Public Key
                    </Button>
                    {/* 源 warning plain：下载需口令确认的语义以文案承载。 */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={privateDownload.isPending}
                      onClick={() => setPwdOpen(true)}
                    >
                      Download Private Key (password required)
                    </Button>
                  </div>
                </div>
              </section>

              {/* 下行公钥（管理侧下发）；指纹占行可复制（§6.3）。 */}
              <section className="rounded-lg border border-border/60 bg-card">
                <div className="border-b border-border/50 px-4 py-3">
                  <h3 className="text-base font-semibold leading-6 text-foreground">
                    Downlink Public Key (delivered by management side)
                  </h3>
                </div>
                <div className="panel-pad flex flex-col gap-3">
                  <DescGrid cols={2}>
                    <DescField label="Fingerprint" span>
                      <CopyableEllipsisText
                        value={view.downlinkFingerprint}
                        emptyText="-"
                        maxWidth={440}
                        className="t-identifier"
                      />
                    </DescField>
                    <DescField label="Delivered At">
                      <span className="font-mono text-xs">
                        {formatTime(view.downlinkPushTime)}
                      </span>
                    </DescField>
                  </DescGrid>
                  <PemBlock label="Public Key PEM" pem={view.downlinkPublicKey} />
                </div>
              </section>

              {/* 一次性接入 key + 重置（源 key-card「接入与重置」）。
                  Reset 属对象级破坏性低频操作，留在本卡上下文（§6.3 动作贴近字段）。 */}
              <section className="rounded-lg border border-border/60 bg-card">
                <div className="border-b border-border/50 px-4 py-3">
                  <h3 className="text-base font-semibold leading-6 text-foreground">
                    Access &amp; Reset
                  </h3>
                </div>
                <div className="panel-pad flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      One-time Access Key
                    </span>
                    <Badge variant={accessKeyStatusVariant(view.accessKeyStatus)}>
                      {accessKeyStatusText(view.accessKeyStatus)}
                    </Badge>
                    {/* 源 meta-hint：激活即失效,仅状态展示。 */}
                    <span className="text-xs text-muted-foreground">
                      Invalidated once activated; status display only
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          Reset Keys
                          <ChevronDown />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => setResetDirection('upstream')}
                        >
                          Reset uplink key (regenerate locally and re-push
                          public key)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setResetDirection('downstream')}
                        >
                          Reset downlink public key (management side
                          regenerates and delivers)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </section>
            </>
          )}
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
