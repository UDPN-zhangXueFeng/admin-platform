'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@myorg/shared/ui';
import { useUpdateNodeStateMutation } from '@myorg/modules/blockchain/data-access';
import { NODE_STATE } from '@myorg/modules/blockchain/util';
import type { NodeModalInfo } from './node-list-page';
import { validateDeleteUrl } from './node-delete-validation';

/**
 * 删除确认 Modal 表单值（单字段，用于 react-hook-form 受控）。
 *
 * `note` 为用户输入的确认文本，必须严格 === modalInfo.url 才通过校验。
 */
interface DeleteFormValues {
  note: string;
}

/**
 * NodeDeleteModal — 节点删除二次确认 Modal。
 *
 * 迁移自 td-manage src/pages/blockchain/node/index.tsx 的删除 CustomModal
 * （文档步骤 9 / bc-10）。
 *
 * 业务规则：
 * - 展示提示文案：`blockchain_0022`（上方）+ `blockchain_0023`（带 {url} 插值，加粗）。
 * - Input 占位 = modalInfo.url；用户输入必须**严格 === modalInfo.url**
 *   （含协议/路径完整）才通过校验——迁移到 react-hook-form 用自定义 validate。
 *   - 空 → 错误文案 `deleteInputRequired`；
 *   - 非空但不等 → 错误文案动态拼接 `deleteInputMismatch`（{url} 插值）。
 *   > 源码用 `Please fill in ${url}` 字符串拼接（文档第 8 章标注为可规范化的英文
 *     key），此处改为 next-intl 插值 `t('deleteInputMismatch', { url })`，
 *     语义等价、可 i18n。
 * - 取消：reset 表单 + onClose（提交中禁用关闭）。
 * - 提交：调 `useUpdateNodeStateMutation({ state: NODE_STATE.DELETE })`，
 *   成功 → `toast.success(deleteSuccess)` + reset + onClose；
 *   mutation 内部 onSuccess 已 invalidate node 查询缓存，列表自动刷新。
 * - `modalInfo` 由列表页（NodeListPage）的 handleOpenDelete 填充：
 *   url 为节点 url 数组 `\n` 拼接后的字符串。
 */
export interface NodeDeleteModalProps {
  /** Modal 上下文（open/url/blockchainId/nodeLocationId）。 */
  modalInfo: NodeModalInfo;
  /** 关闭回调（取消 / 提交成功 / 透传 onOpenChange=false 时调用）。 */
  onClose: () => void;
}

export function NodeDeleteModal({
  modalInfo,
  onClose,
}: NodeDeleteModalProps): React.JSX.Element {
  const t = useTranslations('modules.blockchain');
  const updateStateMutation = useUpdateNodeStateMutation();

  const {
    register,
    handleSubmit,
    reset,
    clearErrors,
    formState: { errors },
  } = useForm<DeleteFormValues>({
    defaultValues: { note: '' },
  });

  const spinning = updateStateMutation.isPending;

  // 打开时 / 切换节点时重置表单与错误态（对齐源码 destroyOnClose + resetFields）。
  React.useEffect(() => {
    if (modalInfo.open) {
      reset({ note: '' });
      clearErrors('note');
    }
  }, [modalInfo.open, modalInfo.url, reset, clearErrors]);

  const onValid = () => {
    updateStateMutation.mutate(
      {
        blockchainId: modalInfo.blockchainId,
        nodeLocationId: modalInfo.nodeLocationId,
        state: NODE_STATE.DELETE,
      },
      {
        onSuccess: () => {
          toast.success(t('deleteSuccess'));
          reset({ note: '' });
          onClose();
        },
      },
    );
  };

  // 提交中禁止关闭（对齐 mmf/statements Modal 模式）。
  const handleOpenChange = (next: boolean) => {
    if (spinning) return;
    if (!next) {
      reset({ note: '' });
      onClose();
    }
  };

  const handleCancel = () => {
    if (spinning) return;
    reset({ note: '' });
    onClose();
  };

  return (
    <Dialog open={modalInfo.open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[35%] min-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('action.delete')}</DialogTitle>
        </DialogHeader>

        <div className={spinning ? 'pointer-events-none opacity-60' : ''}>
          {/* 提示区：blockchain_0022（普通）+ blockchain_0023（带 url 插值，加粗） */}
          <div className="w-full">
            <div className="text-sm">{t('blockchain_0022')}</div>
            <div className="my-4 font-semibold">
              {t('blockchain_0023', { url: modalInfo.url })}
            </div>
          </div>

          <form onSubmit={handleSubmit(onValid)} noValidate>
            <Input
              {...register('note', {
                validate: (value) =>
                  validateDeleteUrl(value ?? '', modalInfo.url, {
                    required: t('deleteInputRequired'),
                    mismatch: (url) => t('deleteInputMismatch', { url }),
                  }),
              })}
              placeholder={modalInfo.url}
              aria-invalid={!!errors.note}
              autoComplete="off"
            />
            {errors.note ? (
              <p className="mt-1 text-xs text-red-600">{errors.note.message}</p>
            ) : null}

            <DialogFooter className="mt-6 flex-row justify-center gap-4 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={spinning}
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" disabled={spinning}>
                {t('action.submit')}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
