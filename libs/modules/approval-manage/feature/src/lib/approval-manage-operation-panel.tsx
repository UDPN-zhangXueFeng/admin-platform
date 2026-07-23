'use client';

import * as React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@myorg/shared/ui';

import {
  usePreviousStepMutation,
  useProcessApprovalMutation,
  type ApprovedDetail,
} from '@myorg/modules/approval-manage/data-access';
import { ApprovalManageEscalationDrawer } from './approval-manage-escalation-drawer';
import {
  connectToMetamask,
  convertTxHashToRSV,
  signMessage,
} from './approval-manage-metamask';

/**
 * ApprovalManageOperationPanel — 右侧审批操作区。
 *
 * 迁移自 td-manage `src/pages/approval-manage/view.tsx` 审批操作区（L649-864）：
 * - 通过/驳回 Form（L653-775）：approve Radio `'3'`(通过)/`'2'`(驳回) + remarks
 *   TextArea required + Submit + 可选 MetaMask 签名按钮。
 * - 升级 / 退回触发按钮（L662-705）：按 approveButtonDTO.escalationType /
 *   previousStepType 显隐，分别开 Drawer / Modal。
 * - 退回上一步 Modal（L809-864，原 CustomModal+CustomForms）：remarks 必填。
 * - 升级 Drawer 由 <ApprovalManageEscalationDrawer> 实现（见同目录文件）。
 *
 * **approve form（RHF）**：`approve` 默认 '3'，`remarks` 必填。`useWatch(remarks)`
 * 作为 MetaMask 按钮 enabled flag（源 `const flag = Form.useWatch('remarks')` L108）。
 *
 * **提交 multApprovalProcess（源 onFinish L192-219）**：携带 approve/remarks/
 * signatureR/S/V/taskId/busCode；**transCode 取自 approvedDetail.businessContent
 * .transCode**，作为 **Bus-Trace-ID header**（非 body，data-access 已封第二参）。
 * 成功后 reset + onSuccess（刷详情 + 日志，源 getApprovedDetail/getTaskApprovedDetail）。
 *
 * **MetaMask 签名按钮（T13 接入）**：approveButtonDTO.metaMaskSignType===1 时显示，
 * disabled 状态由 remarks 是否填写控制（源 `!flag`）。点击 → connectToMetamask →
 * signMessage(message,1) → convertTxHashToRSV → r==='0' 中止 / 否则注入 RSV → 提交。
 * message=(busCode+taskId+approve+remarks).replaceAll(' ','').toLowerCase()（源 L744-752）。
 * 未装 MetaMask → 弹 AlertDialog 引导安装（源 antd Modal.confirm → shadcn AlertDialog，
 * i18n 化，见 §8 mapping）。ethers v6 改写版签名 helpers 见 approval-manage-metamask.ts。
 *
 * **显隐条件（源 L650）**：仅 approvedDetail.approveButtonDTO.approveType===1 渲染
 * 整个操作区（detail-page 控制是否挂载本组件）。
 */

export interface ApprovalManageOperationPanelProps {
  /** approvedDetail（含 approveButtonDTO + businessContent.transCode）。 */
  approvedDetail?: ApprovedDetail;
  taskId: number;
  busCode: string;
  /** 操作成功回调（刷新详情 + 日志）。 */
  onSuccess?: () => void;
  /** 返回上一页（源 routerBack）。 */
  onBack?: () => void;
}

/** 通过/驳回表单值（源 onFinish values）。 */
interface ApproveFormValues {
  approve: string;
  remarks: string;
  // MetaMask 签名 RSV（T13 注入：signMessage→convertTxHashToRSV；未签时恒为空串）。
  signatureR?: string;
  signatureS?: string;
  signatureV?: string;
}

/** 退回上一步表单值。 */
interface PreviousStepFormValues {
  remarks: string;
}

/** 安全取 businessContent.transCode（字符串，源 `approvedDetail?.businessContent?.transCode || ''`）。 */
function getTransCode(approvedDetail?: ApprovedDetail): string {
  const v = approvedDetail?.businessContent?.transCode;
  return v === undefined || v === null ? '' : String(v);
}

export function ApprovalManageOperationPanel({
  approvedDetail,
  taskId,
  busCode,
  onSuccess,
  onBack,
}: ApprovalManageOperationPanelProps): React.JSX.Element {
  const t = useTranslations('modules.approval-manage');

  const approveButtonDTO = approvedDetail?.approveButtonDTO;
  const showEscalate = approveButtonDTO?.escalationType === 1;
  const showPreviousStep = approveButtonDTO?.previousStepType === 1;
  const showMetaMask = approveButtonDTO?.metaMaskSignType === 1;
  const transCode = getTransCode(approvedDetail);

  // ── 通过/驳回 form（源 form，initialValues approve='3'） ──────────────────────
  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ApproveFormValues>({
    defaultValues: { approve: '3', remarks: '' },
  });

  // 源 L108 `const flag = Form.useWatch('remarks', form)`：remarks 非空时 MetaMask 可点。
  const remarksValue = useWatch({ control, name: 'remarks' });
  const remarksFilled = Boolean(remarksValue);

  // ── 升级 Drawer / 退回 Modal 开关 ─────────────────────────────────────────────
  const [escalateOpen, setEscalateOpen] = React.useState(false);
  const [returnOpen, setReturnOpen] = React.useState(false);

  // ── MetaMask 签名状态（T13） ─────────────────────────────────────────────────
  // 未装 MetaMask 引导开关（connectToMetamask 检测不到 provider 时回调开启）。
  const [metaMaskInstallOpen, setMetaMaskInstallOpen] = React.useState(false);
  // 签名中（connectToMetamask + signMessage 为异步，禁用按钮防重复点击）。
  const [signing, setSigning] = React.useState(false);

  // ── 提交通过/驳回（源 onFinish L192-219） ────────────────────────────────────
  const processMutation = useProcessApprovalMutation();

  const onSubmit = handleSubmit((values) => {
    processMutation.mutate(
      {
        approve: values.approve,
        remarks: values.remarks,
        signatureR: values.signatureR ?? '',
        signatureS: values.signatureS ?? '',
        signatureV: values.signatureV ?? '',
        taskId,
        busCode,
        // transCode → Bus-Trace-ID header（data-access 第二参，非 body）。
        transCode,
      },
      {
        onSuccess: () => {
          toast.success(t('operation.submitSuccess'));
          reset({ approve: '3', remarks: '' });
          onSuccess?.();
        },
        onError: () => toast.error(t('operation.submitError')),
      },
    );
  });

  // ── MetaMask 签名提交（源 view.tsx L733-772） ────────────────────────────────
  // 流程：connectToMetamask → signMessage(message,1) → convertTxHashToRSV →
  // r==='0' 中止 / 否则 setValue 注入 RSV → 触发 onSubmit（handleSubmit 读最新值）。
  // message = (busCode+taskId+approve+remarks).replaceAll(' ','').toLowerCase()。
  const onMetaMaskClick = React.useCallback(async () => {
    if (signing) return;
    setSigning(true);
    try {
      const provider = await connectToMetamask({
        onRequireInstall: () => setMetaMaskInstallOpen(true),
      });
      if (!provider) {
        // 未装 MetaMask（已弹引导）或用户拒绝权限 → 中止。
        return;
      }

      // 源 L744-752：message 拼接（busCode+taskId+approve+remarks，去空格 + 小写）。
      const approve = getValues('approve') ?? '3';
      const remarks = getValues('remarks') ?? '';
      const message = `${busCode}${taskId}${approve}${remarks}`
        .replaceAll(' ', '')
        .toLowerCase();

      const sign = await signMessage(message, 1);
      const rsv = convertTxHashToRSV(sign);
      if (rsv.r === '0') {
        // 签名无效（长度/前缀校验失败）或用户取消签名 → 中止（源 L757-759）。
        toast.error(t('operation.metaMaskSignFailed'));
        return;
      }

      // 注入 RSV 后触发标准提交（onSubmit = handleSubmit 返回，读取含 RSV 的最新值）。
      setValue('signatureR', rsv.r);
      setValue('signatureS', rsv.s);
      setValue('signatureV', rsv.v);
      onSubmit();
    } finally {
      setSigning(false);
    }
  }, [busCode, taskId, getValues, setValue, onSubmit, signing, t]);

  // ── 退回上一步 Modal（源 form1 + onFinishPreviousStep L221-241） ───────────────
  const previousStepMutation = usePreviousStepMutation();
  const {
    control: previousStepControl,
    handleSubmit: handlePreviousStepSubmit,
    reset: resetPreviousStep,
    formState: { errors: previousStepErrors },
  } = useForm<PreviousStepFormValues>({ defaultValues: { remarks: '' } });

  const openReturnModal = React.useCallback(() => {
    resetPreviousStep({ remarks: '' });
    setReturnOpen(true);
  }, [resetPreviousStep]);

  const closeReturnModal = React.useCallback(() => {
    setReturnOpen(false);
    resetPreviousStep({ remarks: '' });
  }, [resetPreviousStep]);

  const onPreviousStepSubmit = handlePreviousStepSubmit((values) => {
    previousStepMutation.mutate(
      {
        busCode,
        remarks: values.remarks,
        taskId,
      },
      {
        onSuccess: () => {
          toast.success(t('operation.submitSuccess'));
          closeReturnModal();
          onSuccess?.();
        },
        onError: () => toast.error(t('operation.submitError')),
      },
    );
  });

  return (
    <div className="space-y-4">
      <h4 className="mb-2 text-base font-semibold">{t('approval_manage_0007')}</h4>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* 升级 / 退回触发按钮（源 L662-705）。 */}
        {(showEscalate || showPreviousStep) ? (
          <div className="flex gap-4">
            {showEscalate ? (
              <Button
                type="button"
                onClick={() => setEscalateOpen(true)}
              >
                {t('approval_manage_0005')}
              </Button>
            ) : null}
            {showPreviousStep ? (
              <Button type="button" onClick={openReturnModal}>
                {t('approval_manage_0006')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* approve Radio（源 L707-716）：'3'=Approve / '2'=Reject。 */}
        <Controller
          control={control}
          name="approve"
          rules={{ required: true }}
          render={({ field }) => (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                {t('approval_manage_0007')}
                <span className="ml-0.5 text-destructive">*</span>
              </span>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex gap-6"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="3" />
                  {t('PUB_Approve')}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="2" />
                  {t('PUB_Reject')}
                </label>
              </RadioGroup>
            </div>
          )}
        />

        {/* remarks TextArea（源 L717-719，required）。 */}
        <Controller
          control={control}
          name="remarks"
          rules={{ required: t('operation.remarksRequired') }}
          render={({ field }) => (
            <div>
              <label
                htmlFor="approve-remarks"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('approval_manage_0028')}
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <Textarea
                id="approve-remarks"
                rows={3}
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!errors.remarks}
              />
              {errors.remarks ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {t('operation.remarksRequired')}
                </p>
              ) : null}
            </div>
          )}
        />

        {/* 操作按钮（源 L721-774）：Back + Submit + MetaMask（T13 接入 ethers v6 签名）。 */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => onBack?.()}>
            {t('PUB_GoBack')}
          </Button>
          <Button type="submit" disabled={processMutation.isPending}>
            {t('PUB_Submit')}
          </Button>
          {showMetaMask ? (
            <>
              <span className="mx-1 text-sm text-muted-foreground">
                {t('operation.or')}
              </span>
              {/*
                MetaMask 签名按钮（T13 已接入，源 L733-772）。
                metaMaskSignType===1 显示；disabled = remarks 未填（源 !flag）或签名中。
                onClick → onMetaMaskClick：connectToMetamask → signMessage(msg,1)
                → convertTxHashToRSV → r==='0' 中止 / 否则注入 RSV → onSubmit。
                ethers v6 改写见 approval-manage-metamask.ts（迁移文档 §8）。
              */}
              <Button
                type="button"
                disabled={!remarksFilled || signing}
                onClick={onMetaMaskClick}
              >
                {t('approval_manage_0004')}
              </Button>
            </>
          ) : null}
        </div>
      </form>

      {/* 退回上一步 Modal（源 L809-864，CustomModal+CustomForms remarks）。 */}
      <Dialog open={returnOpen} onOpenChange={(o) => { if (!o) closeReturnModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('approval_manage_0006')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('approval_manage_0021')}
          </p>
          <form onSubmit={onPreviousStepSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="previous-step-remarks"
                className="block text-sm font-medium"
              >
                {t('approval_manage_0028')}
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <Controller
                control={previousStepControl}
                name="remarks"
                rules={{ required: true }}
                render={({ field }) => (
                  <Textarea
                    id="previous-step-remarks"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!previousStepErrors.remarks}
                  />
                )}
              />
              {previousStepErrors.remarks ? (
                <p className="text-sm text-destructive" role="alert">
                  {t('operation.remarksRequired')}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeReturnModal}>
                {t('PUB_Cancel')}
              </Button>
              <Button type="submit" disabled={previousStepMutation.isPending}>
                {t('PUB_Submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/*
        未装 MetaMask 引导（源 antd Modal.confirm → shadcn AlertDialog，i18n 化）。
        connectToMetamask 检测不到 provider 时 onRequireInstall 开启本弹窗。
        Action → 打开 MetaMask 官网下载页（源 window.open metamask.io/download）。
      */}
      <AlertDialog
        open={metaMaskInstallOpen}
        onOpenChange={setMetaMaskInstallOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('operation.metaMaskNotInstalledTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('operation.metaMaskNotInstalledDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('PUB_Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                window.open('https://metamask.io/download/', '_blank')
              }
            >
              {t('operation.metaMaskInstallConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 升级 Drawer（同目录 ApprovalManageEscalationDrawer）。 */}
      <ApprovalManageEscalationDrawer
        open={escalateOpen}
        taskId={taskId}
        busCode={busCode}
        tokenId={
          typeof approvedDetail?.businessContent?.tokenId === 'number'
            ? (approvedDetail.businessContent.tokenId as number)
            : 0
        }
        onClose={() => setEscalateOpen(false)}
        onSuccess={onSuccess}
      />
    </div>
  );
}

export default ApprovalManageOperationPanel;
